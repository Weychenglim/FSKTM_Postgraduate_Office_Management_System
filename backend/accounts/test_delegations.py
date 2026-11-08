from datetime import timedelta
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .delegations import today
from .models import User, Lecturer, Coordinator, Student

@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class DelegationTests(TestCase):
    def setUp(self):
        self.office = User.objects.create_user('office@delegation.test', role=User.Role.OFFICE_ADMIN, is_staff=False)
        self.user = User.objects.create_user('coord@delegation.test', role=User.Role.COORDINATOR)
        self.lecturer = Lecturer.objects.create(user=self.user, staff_no='DC1')
        Coordinator.objects.create(lecturer=self.lecturer, programme_managed='Programme A')
        student_user = User.objects.create_user('student@delegation.test')
        Student.objects.create(user=student_user, matric_no='DS1', programme='Programme B')
        self.client = APIClient()
        self.client.force_authenticate(self.office)

    def test_grant_union_revoke_and_audit(self):
        from .authorization import coordinator_programmes, coordinator_manages_programme
        from .delegations import today
        response = self.client.post('/api/accounts/coordinator-delegations/', {
            'coordinatorId': self.user.pk, 'programme': ' programme b ',
            'startsOn': str(today()), 'endsOn': str(today()+timedelta(days=2)),
            'justification': 'Cover absence',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'ACTIVE')
        self.assertEqual(coordinator_programmes(self.user), ['Programme A', 'Programme B'])
        self.assertTrue(coordinator_manages_programme(self.user, ' PROGRAMME B '))
        revoked = self.client.post(f"/api/accounts/coordinator-delegations/{response.data['id']}/revoke/", {'reason':'Returned'}, format='json')
        self.assertEqual(revoked.status_code, 200, revoked.data)
        self.assertEqual(revoked.data['revocationReason'], 'Returned')
        self.assertFalse(coordinator_manages_programme(self.user, 'Programme B'))

    def grant(self, **overrides):
        from .delegations import today
        data = {'coordinatorId':self.user.pk, 'programme':'Programme B', 'startsOn':str(today()), 'endsOn':str(today()+timedelta(days=2)), 'justification':'Cover leave'}
        data.update(overrides)
        return self.client.post('/api/accounts/coordinator-delegations/', data, format='json')

    def test_validation_overlap_and_permissions(self):
        from .delegations import today
        for overrides in ({'programme':'Unknown'}, {'programme':'Programme A'}, {'justification':' '}, {'startsOn':str(today()-timedelta(days=1))}, {'endsOn':str(today()-timedelta(days=1))}):
            self.assertEqual(self.grant(**overrides).status_code, 400)
        self.assertEqual(self.grant().status_code, 201)
        self.assertEqual(self.grant(startsOn=str(today()+timedelta(days=2))).status_code, 409)
        self.assertEqual(self.grant(startsOn=str(today()+timedelta(days=3)), endsOn=str(today()+timedelta(days=4))).status_code, 201)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.grant().status_code, 403)
        self.assertEqual(len(self.client.get('/api/accounts/coordinator-delegations/').data), 2)
        self.assertEqual(self.client.get('/api/accounts/coordinator-delegations/options/').status_code, 403)
        self.client.force_authenticate(User.objects.get(email='student@delegation.test'))
        self.assertEqual(self.client.get('/api/accounts/coordinator-delegations/').status_code, 403)

    def test_only_the_approved_programmes_are_offered(self):
        from .programmes import APPROVED_PROGRAMMES
        options = self.client.get('/api/accounts/coordinator-delegations/options/').data
        self.assertEqual(options['programmes'], APPROVED_PROGRAMMES)
        response = self.client.post('/api/accounts/coordinator-delegations/', {
            'coordinatorId': self.user.pk, 'programme': APPROVED_PROGRAMMES[0], 'startsOn': str(today()),
            'endsOn': str(today()), 'justification': 'Covering',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)

    def test_dates_eligibility_retirement_and_programme_binding(self):
        from unittest.mock import patch
        from .authorization import coordinator_programmes, programme_coordinators
        from .delegations import today, delegation_status
        from .models import CoordinatorDelegation
        from .participant_lifecycle import lecturer_blockers
        date = today()
        grant = self.grant(startsOn=str(date+timedelta(days=1)), endsOn=str(date+timedelta(days=2)))
        self.assertEqual(grant.status_code, 201)
        row = CoordinatorDelegation.objects.get(pk=grant.data['id'])
        self.assertEqual(delegation_status(row), 'SCHEDULED')
        self.assertEqual(lecturer_blockers(self.lecturer)['coordinatorDelegations'], 1)
        self.assertEqual(coordinator_programmes(self.user), ['Programme A'])
        Coordinator.objects.filter(pk=self.user.pk).update(programme_managed='Programme C')
        with patch('accounts.delegations.today', return_value=date+timedelta(days=2)):
            self.assertEqual(coordinator_programmes(self.user), ['Programme C', 'Programme B'])
            self.assertIn(self.user, programme_coordinators('Programme B'))
        with patch('accounts.delegations.today', return_value=date+timedelta(days=3)):
            self.assertEqual(delegation_status(row), 'EXPIRED')
            self.assertEqual(lecturer_blockers(self.lecturer)['coordinatorDelegations'], 0)
        self.lecturer.lifecycle_status = Lecturer.Lifecycle.RETIRED
        self.lecturer.save()
        self.assertEqual(coordinator_programmes(self.user), [])
        self.assertEqual(self.grant().status_code, 400)

    def test_immutable_audit_and_scope_whitespace(self):
        from django.core.exceptions import ValidationError
        from .authorization import coordinator_scope_q, coordinator_programmes
        from .models import CoordinatorDelegation
        grant = self.grant()
        row = CoordinatorDelegation.objects.get(pk=grant.data['id'])
        row.justification = 'Rewrite history'
        with self.assertRaises(ValidationError):
            row.save()
        with self.assertRaises(ValidationError):
            CoordinatorDelegation.objects.filter(pk=row.pk).update(justification='Rewrite')
        with self.assertRaises(ValidationError):
            row.delete()
        with self.assertRaises(ValidationError):
            CoordinatorDelegation.objects.bulk_create([row], update_conflicts=True, update_fields=['justification'], unique_fields=['id'])
        Student.objects.update(programme='  pROgramme B  ')
        self.assertEqual(Student.objects.filter(coordinator_scope_q(self.user)).count(), 1)
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(coordinator_programmes(self.user), [])

    def test_own_history_and_revoke_immutable(self):
        grant = self.grant()
        url = f"/api/accounts/coordinator-delegations/{grant.data['id']}/revoke/"
        self.assertEqual(self.client.post(url, {'reason':' '}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'reason':'Return'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {'reason':'Changed reason'}, format='json').status_code, 409)
        self.client.force_authenticate(self.user)
        data = self.client.get('/api/auth/me/').data
        self.assertEqual(data['effectiveProgrammes'], ['Programme A'])
        self.assertEqual(data['coordinatorDelegations'][0]['revocationReason'], 'Return')

    def test_future_grant_blocks_actual_retirement_until_revoked(self):
        from .delegations import today
        from .participant_lifecycle import ParticipantLifecycleConflict, transition_lecturer
        row = self.grant(startsOn=str(today()+timedelta(days=2)), endsOn=str(today()+timedelta(days=3)))
        Coordinator.objects.filter(pk=self.user.pk).update(programme_managed='')
        transition_lecturer(staff_no='DC1', actor=self.office, target_status='RETIRING', reason='Retirement preparation')
        with self.assertRaises(ParticipantLifecycleConflict) as blocked:
            transition_lecturer(staff_no='DC1', actor=self.office, target_status='RETIRED', reason='Retirement')
        self.assertEqual(blocked.exception.blockers['coordinatorDelegations'], 1)
        self.assertEqual(self.client.post(f"/api/accounts/coordinator-delegations/{row.data['id']}/revoke/", {'reason':'Retirement handover'}, format='json').status_code, 200)
        result = transition_lecturer(staff_no='DC1', actor=self.office, target_status='RETIRED', reason='Retirement')
        self.assertEqual(result.lifecycle_status, 'RETIRED')
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_expired_grant_does_not_block_actual_retirement(self):
        from unittest.mock import patch
        from .delegations import today
        from .participant_lifecycle import transition_lecturer
        self.assertEqual(self.grant().status_code, 201)
        Coordinator.objects.filter(pk=self.user.pk).update(programme_managed='')
        transition_lecturer(staff_no='DC1', actor=self.office, target_status='RETIRING', reason='Retirement preparation')
        with patch('accounts.delegations.today', return_value=today()+timedelta(days=3)):
            result = transition_lecturer(staff_no='DC1', actor=self.office, target_status='RETIRED', reason='Retirement')
        self.assertEqual(result.lifecycle_status, 'RETIRED')


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from django.db import close_old_connections, transaction
from django.test import TransactionTestCase


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class DelegationConcurrencyTests(TransactionTestCase):
    setUp = DelegationTests.setUp

    def test_concurrent_overlapping_first_grants_have_one_winner(self):
        from .delegations import DelegationConflict, grant_delegation, today
        from .models import CoordinatorDelegation
        other = User.objects.create_user('other@delegation.test', role=User.Role.COORDINATOR)
        other_lecturer = Lecturer.objects.create(user=other, staff_no='DC2')
        Coordinator.objects.create(lecturer=other_lecturer, programme_managed='Programme C')
        barrier = Barrier(2)
        def grant(coordinator_id):
            close_old_connections()
            try:
                actor = User.objects.get(pk=self.office.pk)
                barrier.wait(timeout=10)
                try:
                    grant_delegation(actor=actor, coordinator_id=coordinator_id, programme=' Programme B ', starts_on=today(), ends_on=today(), justification='Cover')
                    return 'created'
                except DelegationConflict:
                    return 'conflict'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(grant, [self.user.pk, other.pk]))
        self.assertCountEqual(results, ['created', 'conflict'])
        self.assertEqual(CoordinatorDelegation.objects.count(), 1)

    def test_locked_authority_serializes_revocation(self):
        from .authorization import coordinator_manages_programme
        from .delegations import grant_delegation, revoke_delegation, today
        row = grant_delegation(actor=self.office, coordinator_id=self.user.pk, programme='Programme B', starts_on=today(), ends_on=today(), justification='Cover')
        acquired, release, revoking, revoked = Event(), Event(), Event(), Event()
        def decision():
            close_old_connections()
            try:
                with transaction.atomic():
                    user = User.objects.get(pk=self.user.pk)
                    permitted = coordinator_manages_programme(user, 'Programme B', lock=True)
                    acquired.set()
                    if not release.wait(10):
                        raise RuntimeError('Decision release timed out')
                    return permitted
            finally:
                close_old_connections()
        def revoke():
            close_old_connections()
            try:
                revoking.set()
                revoke_delegation(delegation_id=row.pk, actor=User.objects.get(pk=self.office.pk), reason='Return')
                revoked.set()
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            decision_future = pool.submit(decision)
            self.assertTrue(acquired.wait(10))
            revoke_future = pool.submit(revoke)
            self.assertTrue(revoking.wait(10))
            try:
                self.assertFalse(revoked.wait(0.2), 'Revocation must wait for the authorized transaction')
            finally:
                release.set()
            self.assertTrue(decision_future.result(timeout=10))
            revoke_future.result(timeout=10)
        with transaction.atomic():
            self.assertFalse(coordinator_manages_programme(self.user, 'Programme B', lock=True))
