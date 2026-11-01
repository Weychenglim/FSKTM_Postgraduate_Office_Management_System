"""Appointment letters follow the appointments: a letter is made when a
supervisor, panel or supporting supervisor appointment is approved, and revoked
when that appointment ends or is replaced.

The appointment code is not changed. Each step runs once the change is saved
for good, and a letter that cannot be made or revoked never undoes it.
"""
from functools import partial

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from appointments.models import CoSupervisorAppointment, PanelAppointment, SupervisorAppointment

from .appointment_letters import make_letter_after_approval, revoke_after_end


def _after_save(model, instance, created, raw):
    if raw:
        return
    if created and instance.status == model.Status.ACTIVE:
        transaction.on_commit(partial(make_letter_after_approval, model, instance.pk), robust=True)
    elif not created and instance.status != model.Status.ACTIVE:
        transaction.on_commit(partial(revoke_after_end, model, instance.pk), robust=True)


@receiver(post_save, sender=SupervisorAppointment, dispatch_uid="letters-supervisor-appointment-letter")
def supervisor_appointment_saved(sender, instance, created, raw=False, **kwargs):
    _after_save(SupervisorAppointment, instance, created, raw)


@receiver(post_save, sender=PanelAppointment, dispatch_uid="letters-panel-appointment-letter")
def panel_appointment_saved(sender, instance, created, raw=False, **kwargs):
    _after_save(PanelAppointment, instance, created, raw)


@receiver(post_save, sender=CoSupervisorAppointment, dispatch_uid="letters-co-supervisor-appointment-letter")
def co_supervisor_appointment_saved(sender, instance, created, raw=False, **kwargs):
    _after_save(CoSupervisorAppointment, instance, created, raw)
