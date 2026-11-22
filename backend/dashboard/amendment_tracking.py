"""Scoped, read-only projections of audited research amendment workflows."""

from django.utils import timezone

from appointments.ageing import elapsed_calendar_days


def amendment_waiting_metadata(row, *, now=None):
    from appointments.research_amendments import review_status
    if not row.status.startswith('PENDING_'):
        return {'waitingSince': None, 'waitingDays': None, 'waitingOn': None}
    return {
        'waitingSince': row.updated_at,
        'waitingDays': elapsed_calendar_days(row.updated_at, now=now),
        'waitingOn': review_status(row).removeprefix('PENDING_'),
    }


def amendment_actions(actor, now):
    from accounts.models import User
    from appointments.models import ResearchAmendment
    from appointments.research_amendments import can_decide, scoped_requests

    result = []
    for row in scoped_requests(actor).filter(status__in=ResearchAmendment.PENDING_STATUSES):
        if actor.role not in {User.Role.OFFICE_ADMIN, User.Role.STUDENT} and not can_decide(row, actor):
            continue
        metadata = amendment_waiting_metadata(row, now=now)
        result.append({
            'id': f'research_amendment_{row.pk}',
            'name': f'Research amendment: {row.student.user.full_name}',
            'status': 'pending',
            'statusText': f'{metadata["waitingOn"].replace("_", " ").title()} for {metadata["waitingDays"]} calendar days',
            'target': 'Supervisor Appointments', 'targetModule': 'SUPERVISOR_APPOINTMENTS',
            'recordType': 'RESEARCH_AMENDMENT', 'recordId': str(row.pk),
            **metadata,
            'semester': row.academic_semester.label if row.academic_semester else None,
            'semesterCode': row.academic_semester.code if row.academic_semester else None,
            'dueAt': None, 'daysUntilDue': None, 'deadlineState': None,
        })
    return result


def amendment_report_rows(actor, programme, start_date, end_date, now, selector, semester):
    from appointments.research_amendments import scoped_requests, review_status
    from .reports import _age_band, _filter_semester, _iso, _semester_row, _within_range

    rows = _filter_semester(scoped_requests(actor), 'academic_semester', selector, semester)
    if programme:
        rows = rows.filter(student__programme__trim__iexact=programme)
    result = []
    for row in rows:
        if not _within_range(row.created_at, start_date, end_date):
            continue
        metadata = amendment_waiting_metadata(row, now=now)
        result.append({
            'recordId': str(row.pk), 'recordType': 'RESEARCH_AMENDMENT',
            'studentId': row.matric_no, 'studentName': row.student_name,
            'programme': row.source_programme, 'kind': row.kind, 'status': review_status(row),
            'sourceProgramme': row.source_programme, 'destinationProgramme': row.destination_programme,
            'baselineRevision': row.baseline_revision,
            'reportDate': _iso(row.created_at),
            **metadata, 'waitingSince': _iso(metadata['waitingSince']),
            'ageBand': _age_band(metadata['waitingDays']),
            **_semester_row(row.academic_semester),
        })
    return result


def amendment_dossier(actor, student, now=None):
    from appointments.research_amendments import request_payload, scoped_requests

    result = []
    for row in scoped_requests(actor).filter(student=student):
        metadata = amendment_waiting_metadata(row, now=now)
        result.append({**request_payload(row, actor), **metadata,
                       'waitingSince': metadata['waitingSince'].isoformat() if metadata['waitingSince'] else None})
    return result


def amendment_reconciliation_issues():
    from accounts.models import Student
    from appointments.models import ResearchAmendment, ResearchProfileRevision, StudentResearchProfile
    from appointments.research_amendments import revision_chain_matches, snapshot, team_identity, team_snapshot
    from .reconciliation import ReconciliationIssue, _issue_id, _normalized

    issues = []

    def issue(kind, record_type, record_id, student, title, state):
        issues.append(ReconciliationIssue(
            issue_id=_issue_id(kind, record_type, record_id), module='SUPERVISOR_APPOINTMENTS',
            issue_type=kind, severity='BLOCKING', repairability='REVIEW_REQUIRED',
            title=title, summary='Review the approved research record and its immutable amendment history. No automatic academic repair is available.',
            record_type=record_type, record_id=str(record_id), programme=student.programme,
            student_id=student.matric_no, current_state=state,
        ))

    students = {row.user_id: row for row in Student.objects.all()}
    for profile in StudentResearchProfile.objects.all():
        student = students.get(profile.student_id)
        if student is None:
            continue
        if _normalized(profile.programme) != _normalized(student.programme):
            issue('RESEARCH_PROGRAMME_MISMATCH', 'RESEARCH_PROFILE', profile.pk, student,
                  'Student and approved research programmes differ',
                  {'studentProgramme': student.programme, 'researchProgramme': profile.programme})
        revisions = list(ResearchProfileRevision.objects.filter(profile=profile).order_by('revision', 'id'))
        broken = bool(profile.revision and not revisions)
        if revisions:
            broken = not revision_chain_matches(profile, revisions)
        if broken:
            issue('RESEARCH_REVISION_CHAIN_BROKEN', 'RESEARCH_PROFILE', profile.pk, student,
                  'Approved research revision history is inconsistent',
                  {'currentRevision': profile.revision, 'revisions': [row.revision for row in revisions]})
    for row in ResearchAmendment.objects.filter(status__in=ResearchAmendment.PENDING_STATUSES).select_related('student', 'profile'):
        if (row.baseline_revision != row.profile.revision
            or row.before_values != snapshot(row.profile, row.before_values)
            or (row.kind == 'TRANSFER' and team_identity(row.team_snapshot) != team_identity(team_snapshot(row.student_id)))):
            issue('RESEARCH_AMENDMENT_STALE', 'RESEARCH_AMENDMENT', row.pk, row.student,
                  'Pending amendment uses an outdated approved research revision',
                  {'baselineRevision': row.baseline_revision, 'currentRevision': row.profile.revision})
    return issues
