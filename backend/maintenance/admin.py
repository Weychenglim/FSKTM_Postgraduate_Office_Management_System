"""Portal maintenance in Django admin. Only the technical administrator can sign
in here, and the admin site keeps working while the portal is under maintenance."""
from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.dateformat import format as format_date
from django.utils.html import format_html, format_html_join

from . import state
from .models import MaintenanceEvent, PortalMaintenance

WHEN = (("off", "Off"), ("now", "On now"), ("later", "Planned"))
FROM_STATUS = {state.OFF: "off", state.PLANNED: "later", state.ON: "now"}
OUTCOME = {
    state.OFF: "Maintenance is off. Everyone can use the portal.",
    state.PLANNED: "Maintenance is planned. Signed-in people see a warning until it starts.",
    state.ON: "Maintenance is on. Nobody can use the portal until you switch it off.",
}


def moment(value):
    return format_date(timezone.localtime(value), "D j M Y, g:i A") if value else ""


class PortalMaintenanceForm(forms.ModelForm):
    when = forms.ChoiceField(
        label="Maintenance",
        choices=WHEN,
        widget=forms.RadioSelect,
        help_text="Off: everyone can use the portal. On now: nobody can, office staff included. Planned: it starts at the time below.",
    )

    class Meta:
        model = PortalMaintenance
        fields = ("starts_at", "expected_end", "message")
        labels = {"starts_at": "Starts at", "expected_end": "Expected back by", "message": "Message to everyone"}
        help_texts = {
            "starts_at": "Only for planned maintenance. Malaysia time.",
            "expected_end": "Optional. Shown to everyone. Maintenance only ends when you switch it off.",
            "message": f'Optional, up to {state.MAX_MESSAGE} characters. Left empty, people see: "{state.DEFAULT_MESSAGE}"',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.was = state.saved_status()
        self.fields["when"].initial = FROM_STATUS[self.was]

    def clean(self):
        data = super().clean()
        when = data.get("when")
        if when not in ("now", "later"):
            return data
        starts_at = data.get("starts_at") if when == "later" else None
        if when == "later" and starts_at is None and "starts_at" not in self.errors:
            self.add_error("starts_at", "Choose when it starts.")
            return data
        found = state.problems(self.was, starts_at, data.get("expected_end"), data.get("message"), timezone.now())
        for field, error in found.items():
            self.add_error(field, error)
        return data


@admin.register(PortalMaintenance)
class PortalMaintenanceAdmin(admin.ModelAdmin):
    form = PortalMaintenanceForm
    fields = ("right_now", "when", "starts_at", "expected_end", "message", "recent")
    readonly_fields = ("right_now", "recent")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        PortalMaintenance.objects.get_or_create(pk=1)
        return redirect(reverse("admin:maintenance_portalmaintenance_change", args=[1]))

    def get_object(self, request, object_id, from_field=None):
        if str(object_id) == "1":
            PortalMaintenance.objects.get_or_create(pk=1)
        return super().get_object(request, object_id, from_field)

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        extra_context = {**(extra_context or {}), "show_save_and_continue": False, "show_save_and_add_another": False}
        return super().changeform_view(request, object_id, form_url, extra_context)

    @admin.display(description="Right now")
    def right_now(self, obj):
        found = state.status({"startsAt": obj.starts_at})
        if found == state.OFF:
            return "Off. Everyone can use the portal."
        end = f" Expected back by {moment(obj.expected_end)}." if obj.expected_end else ""
        if found == state.PLANNED:
            return f"Planned from {moment(obj.starts_at)}.{end} Set by {obj.set_by_name}."
        return f"On since {moment(obj.starts_at)}. Nobody can use the portal.{end} Set by {obj.set_by_name}."

    @admin.display(description="Recent changes")
    def recent(self, obj):
        events = MaintenanceEvent.objects.all()[:10]
        if not events:
            return "Nothing yet."
        rows = format_html_join(
            "", "<li>{}, {}, {}</li>", ((event.get_action_display(), event.actor_name, moment(event.created_at)) for event in events)
        )
        return format_html(
            '<ul style="margin:0;padding-left:1.2em">{}</ul><p><a href="{}">All maintenance history</a></p>',
            rows,
            reverse("admin:maintenance_maintenanceevent_changelist"),
        )

    def save_model(self, request, obj, form, change):
        when = form.cleaned_data["when"]
        try:
            if when == "off":
                if form.was != state.OFF:
                    state.end(request.user)
            else:
                state.change(
                    request.user,
                    starts_at=form.cleaned_data["starts_at"] if when == "later" else None,
                    expected_end=form.cleaned_data["expected_end"],
                    message=form.cleaned_data["message"],
                )
        except state.MaintenanceProblem as problem:
            self.message_user(request, " ".join(problem.errors.values()), messages.ERROR)

    def response_change(self, request, obj):
        self.message_user(request, OUTCOME[state.saved_status()], messages.SUCCESS)
        return redirect(request.path)


@admin.register(MaintenanceEvent)
class MaintenanceEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "actor_name", "starts_at", "expected_end")
    list_filter = ("action",)
    readonly_fields = ("action", "actor", "actor_name", "starts_at", "expected_end", "message", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
