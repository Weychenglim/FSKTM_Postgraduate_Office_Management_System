from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class PortalMaintenance(models.Model):
    """The portal's one maintenance setting. From ``starts_at`` until the
    technical administrator ends it, nobody can use the portal."""

    starts_at = models.DateTimeField(null=True, blank=True)
    expected_end = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True)
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    set_by_name = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "portal maintenance"
        verbose_name_plural = "portal maintenance"

    def __str__(self):
        return "Portal maintenance"


class MaintenanceEvent(models.Model):
    """Who planned, started, changed, ended or cancelled maintenance, and when."""

    class Action(models.TextChoices):
        PLANNED = "PLANNED", "Planned maintenance"
        STARTED = "STARTED", "Started maintenance"
        CHANGED = "CHANGED", "Changed the maintenance details"
        ENDED = "ENDED", "Ended maintenance"
        CANCELLED = "CANCELLED", "Cancelled the planned maintenance"

    action = models.CharField(max_length=16, choices=Action.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_events",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expected_end = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "maintenance change"
        verbose_name_plural = "maintenance history"
        ordering = ["-created_at", "-pk"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Maintenance history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Maintenance history cannot be deleted.")
