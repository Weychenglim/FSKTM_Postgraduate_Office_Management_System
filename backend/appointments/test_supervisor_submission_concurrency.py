from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
from threading import Barrier
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection, connections
from django.test import override_settings
from rest_framework.test import APIClient, APITransactionTestCase

from announcements.models import Notification
from .research_intent_test_helpers import valid_research_intent_json
from .models import SupervisorApplication, SupervisorApplicationDocument, SupervisorAppointment, AppointmentWorkflowEvent
from .serializers import SupervisorApplicationCreateSerializer
from . import test_supervisor_workflow as fixture


class SupervisorSubmissionConcurrencyTests(APITransactionTestCase):
    setUp = fixture.SupervisorAppointmentWorkflowTests.setUp

    def test_simultaneous_submissions_return_one_creation_and_one_clear_rejection(self):
        if connection.vendor != 'postgresql':
            self.skipTest('Requires PostgreSQL row locking')
        barrier = Barrier(2)
        original = SupervisorApplicationCreateSerializer.validate

        def validate(serializer, attrs):
            result = original(serializer, attrs)
            # Both requests pass the initial empty-queue check before either saves.
            barrier.wait(timeout=20)
            return result

        def submit(supervisor):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '20s'")
                client = APIClient()
                client.force_authenticate(self.student_user)
                response = client.post('/api/appointments/supervisor/applications/', {
                    'proposedSupervisorId': supervisor.lecturer.staff_no,
                    'projectCourseCodes': 'WQD7002',
                    'researchTitle': 'Concurrent synthetic proposal',
                    'researchArea': 'Artificial Intelligence',
                    'researchAbstract': 'Fictional proposal to exercise simultaneous request submission.',
                    "researchIntent": valid_research_intent_json(),
                    'documents': [SimpleUploadedFile('proposal.pdf', b'%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', content_type='application/pdf')],
                    'requirementCodes': ['research-proposal'],
                }, format='multipart')
                return response.status_code, str(response.data)
            finally:
                connections.close_all()

        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media), patch.object(SupervisorApplicationCreateSerializer, 'validate', validate):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(submit, supervisor) for supervisor in [self.supervisor_user, self.other_supervisor]]
                results = [future.result(timeout=40) for future in futures]
            self.assertCountEqual([code for code, _ in results], [201, 400])
            self.assertIn('active supervisor application already exists', next(body for code, body in results if code == 400))
            self.assertEqual(SupervisorApplication.objects.count(), 1)
            self.assertEqual(SupervisorApplicationDocument.objects.count(), 1)
            self.assertEqual(AppointmentWorkflowEvent.objects.filter(action='SUBMIT').count(), 1)
            self.assertEqual(Notification.objects.count(), 1)
            self.assertEqual(SupervisorAppointment.objects.count(), 0)
