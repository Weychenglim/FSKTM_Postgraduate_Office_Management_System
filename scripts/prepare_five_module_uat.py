"""Prepare a separate, local-only manual UAT database; never reset existing data.

Run with the repository virtual environment. Credentials and uploads live in
backend/.env.five-module-uat/ (gitignored). No academic workflow is pre-approved.
"""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
PRIVATE = BACKEND / ".env.five-module-uat"
CONFIG = PRIVATE / "sandbox.json"
AI = "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)"
DS = "MASTER OF DATA SCIENCE (COURSEWORK)"
CYBER = "MASTER OF CYBER SECURITY (COURSEWORK)"
UAT_AI_DEPARTMENT = "Fictional UAT Artificial Intelligence Department"
UAT_DS_DEPARTMENT = "Fictional UAT Data Science Department"
UAT_CYBER_DEPARTMENT = "Fictional UAT Cyber Security Department"
LECTURER_DEPARTMENTS = {
    "primary": UAT_AI_DEPARTMENT, "support": UAT_AI_DEPARTMENT,
    "capacity": UAT_AI_DEPARTMENT,
    "replacement": UAT_DS_DEPARTMENT, "support-new": UAT_DS_DEPARTMENT,
    "panel": UAT_DS_DEPARTMENT,
    "outsider": UAT_CYBER_DEPARTMENT, "panel-new": UAT_CYBER_DEPARTMENT,
    "retire": UAT_CYBER_DEPARTMENT,
}


def validate_target(name, host):
    if not re.fullmatch(r"fsktm_uat_\d{8}_[a-f0-9]{6}", str(name)):
        raise ValueError("Refusing any database outside this helper's named UAT sandbox.")
    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("This helper only prepares a local PostgreSQL sandbox.")


def validate_private_directory(path):
    if Path(path).resolve() != PRIVATE.resolve():
        raise ValueError("Credentials must stay in backend/.env.five-module-uat/.")
    result = subprocess.run(
        ["git", "check-ignore", "--quiet", "--", str(PRIVATE / "sandbox.json")],
        cwd=ROOT, check=False, capture_output=True,
    )
    if result.returncode != 0:
        raise ValueError("Private credentials directory must be ignored by Git.")


def account_specs():
    rows = []

    def add(key, ident, role, name, **extra):
        rows.append(dict(key=key, id=ident, role=role, name=f"UAT {name}",
                         email=f"uat.{key}@example.test", **extra))

    add("office", "UAT-OFFICE", "Office Staff/Admin", "Office", marks_permission=True)
    add("office-view", "UAT-OFFICE-VIEW", "Office Staff/Admin", "Office without Marks correction", marks_permission=False)
    for key, programme in [("ai", AI), ("ds", DS), ("cyber", CYBER)]:
        add(f"coord-{key}", f"UAT-COORD-{key.upper()}", "Programme Coordinator", f"Coordinator {key.upper()}", programme=programme, department={"ai": UAT_AI_DEPARTMENT, "ds": UAT_DS_DEPARTMENT, "cyber": UAT_CYBER_DEPARTMENT}[key])
    for key, supervisor, panel in [
        ("primary", 20, 20), ("replacement", 20, 20), ("support", 20, 20),
        ("support-new", 20, 20), ("panel", None, 20), ("panel-new", None, 20),
        ("outsider", 20, 20), ("capacity", 1, None), ("retire", 20, 20),
    ]:
        add(key, f"UAT-{key.upper()}", "Lecturer", key.replace('-', ' ').title(), supervisor=supervisor, panel=panel, department=LECTURER_DEPARTMENTS[key])
    students = [
        ("main", AI), ("reject", AI), ("replace", AI), ("support", AI),
        ("research", AI), ("window", AI), ("defer", AI), ("withdraw", AI),
        ("graduate", AI), ("capacity-a", AI), ("capacity-b", AI),
        ("carryover", AI), ("retire", AI), ("foreign", DS), ("unrelated", CYBER),
        ("capacity-c", AI),
    ]
    for number, (key, programme) in enumerate(students, start=1):
        add(f"student-{key}", f"UAT-S{number:02}", "Student", f"Student {number:02} {key.replace('-', ' ').title()}", programme=programme)
    add("technical", "UAT-TECHNICAL", "Technical Administrator", "Technical Administrator")
    return rows


def configure(config):
    # Read existing connection credentials without printing or rewriting .env.
    sys.path.insert(0, str(BACKEND))
    from dotenv import load_dotenv
    load_dotenv(BACKEND / ".env", override=False)
    validate_target(config["database"], os.getenv("PGHOST", "localhost"))
    os.environ.update({
        "DJANGO_SETTINGS_MODULE": "config.settings", "PGDATABASE": config["database"],
        "DJANGO_DEBUG": "True", "DJANGO_SECRET_KEY": config["secret_key"],
        "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1", "ENABLE_DEMO_ACCOUNTS": "False",
        "FRONTEND_URL": config["portal_url"], "CORS_ALLOWED_ORIGINS": config["portal_url"],
        "EMAIL_HOST_USER": "", "EMAIL_HOST_PASSWORD": "", "DJANGO_CACHE_BACKEND": "locmem",
    })
    import config.settings as project_settings
    project_settings.MEDIA_ROOT = PRIVATE / "media"
    project_settings.EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    project_settings.JWT_REFRESH_COOKIE_NAME = "fsktm_five_module_uat_refresh"
    project_settings.SESSION_COOKIE_NAME = "fsktm_five_module_uat_session"
    project_settings.CSRF_COOKIE_NAME = "fsktm_five_module_uat_csrf"
    import django
    django.setup()
    # The rotation-grace cookie is a module constant, separate from settings.
    # Isolate it too so UAT does not overwrite a normal portal session key.
    from accounts import session_tokens, views as account_views
    session_tokens.SESSION_KEY_COOKIE = "fsktm_five_module_uat_session_key"
    account_views.SESSION_KEY_COOKIE = session_tokens.SESSION_KEY_COOKIE
    from django.db import connection
    if connection.settings_dict["NAME"] != config["database"]:
        raise RuntimeError("UAT database isolation check failed.")


def write_inputs():
    from reportlab.pdfgen.canvas import Canvas
    inputs = PRIVATE / "inputs"
    inputs.mkdir(exist_ok=True)
    pdf = Canvas(str(inputs / "research-proposal.pdf"))
    pdf.drawString(50, 790, "Fictional five-module UAT research proposal")
    pdf.drawString(50, 765, "Synthetic records only. No real participants or academic claims.")
    pdf.save()
    (inputs / "invalid-empty.pdf").write_bytes(b"")
    (inputs / "invalid-renamed.pdf").write_text("This is plain text, not a PDF.", encoding="utf-8")
    (inputs / "unsupported.txt").write_text("Benign unsupported upload for validation testing.", encoding="utf-8")
    valid = (inputs / "research-proposal.pdf").read_bytes()
    (inputs / "over-10mb.pdf").write_bytes(valid + b"\n%" + b"x" * (10 * 1024 * 1024 + 1))


def prepare():
    validate_private_directory(PRIVATE)
    if CONFIG.exists():
        print("Existing UAT sandbox preserved. Use --check or --start; nothing was reset.")
        return
    from dotenv import load_dotenv
    load_dotenv(BACKEND / ".env", override=False)
    today = datetime.now(ZoneInfo("Asia/Kuala_Lumpur")).strftime("%Y%m%d")
    config = {
        "database": f"fsktm_uat_{today}_{secrets.token_hex(3)}",
        "secret_key": secrets.token_urlsafe(60),
        "portal_url": "http://127.0.0.1:3003", "api_url": "http://127.0.0.1:8003",
        "accounts": [{**item, "password": secrets.token_urlsafe(18)} for item in account_specs()],
        "prepared_at": datetime.now(ZoneInfo("Asia/Kuala_Lumpur")).isoformat(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "starting_diff_sha256": hashlib.sha256(subprocess.check_output(["git", "diff", "--binary"], cwd=ROOT)).hexdigest(),
    }
    validate_target(config["database"], os.getenv("PGHOST", "localhost"))
    import psycopg2
    from psycopg2 import sql
    admin = psycopg2.connect(
        dbname="postgres", user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD"), host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
    )
    try:
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname=%s", [config["database"]])
            if cursor.fetchone():
                raise RuntimeError("Sandbox name already exists; refusing to reuse or reset it.")
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(config["database"])))
    finally:
        admin.close()
    configure(config)
    from django.core.management import call_command
    from django.db import transaction
    from django.contrib.auth.models import Permission
    from accounts.models import Coordinator, Lecturer, OfficeStaff, Panel, Student, Supervisor, User
    call_command("migrate", interactive=False, verbosity=0)
    with transaction.atomic():
        if User.objects.exists():
            raise RuntimeError("Expected a fresh empty user table; no accounts were changed.")
        for row in config["accounts"]:
            create = User.objects.create_superuser if row["role"] == User.TECHNICAL_ADMIN else User.objects.create_user
            user = create(email=row["email"], password=row["password"], full_name=row["name"], role=row["role"])
            if row["role"] == User.Role.OFFICE_ADMIN:
                OfficeStaff.objects.create(user=user, staff_no=row["id"], department="Fictional UAT Office")
                if row["marks_permission"]:
                    user.user_permissions.add(Permission.objects.get(content_type__app_label="marks", codename="change_markentry"))
            elif row["role"] == User.Role.STUDENT:
                Student.objects.create(user=user, matric_no=row["id"], programme=row["programme"], intake_semester="2026/2027 Semester 1")
            elif row["role"] in {User.Role.LECTURER, User.Role.COORDINATOR}:
                lecturer = Lecturer.objects.create(user=user, staff_no=row["id"], title="Dr.", department=row["department"], specialization="Synthetic workflow testing")
                if row["role"] == User.Role.COORDINATOR:
                    Coordinator.objects.create(lecturer=lecturer, programme_managed=row["programme"])
                else:
                    if row["supervisor"] is not None:
                        Supervisor.objects.create(lecturer=lecturer, max_supervisees=row["supervisor"])
                    if row["panel"] is not None:
                        Panel.objects.create(lecturer=lecturer, max_appointments=row["panel"])
    PRIVATE.mkdir(exist_ok=True)
    CONFIG.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    write_inputs()
    lines = ["# Private local UAT accounts", "", f"Portal: {config['portal_url']}", f"Database: `{config['database']}`", "",
             "Generated local-only passwords. Do not commit, share, or reuse them elsewhere.", "",
             "| Use | Login email | Student/staff ID | Password |", "| --- | --- | --- | --- |"]
    lines += [f"| {row['name']} | {row['email']} | {row['id']} | `{row['password']}` |" for row in config['accounts']]
    lines += ["", "Technical Administrator: Django Admin only; its listed ID is a label, not an alternative portal login.", "",
              "No semester, capacity policy, appointment, research profile, rubric, evaluation task or delegation was seeded.",
              "Office prepares these in the guide. Every student and lecturer starts Active.", ""]
    (PRIVATE / "ACCOUNTS.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Prepared {len(config['accounts'])} fictional accounts in {config['database']}.")
    print(f"Private account sheet: {PRIVATE / 'ACCOUNTS.md'}")


def read_config():
    validate_private_directory(PRIVATE)
    if not CONFIG.is_file():
        raise RuntimeError("Run this helper without flags to prepare the sandbox first.")
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def check(config):
    configure(config)
    from accounts.authorization import can_correct_marks
    from accounts.models import User
    from academics.models import AcademicSemester
    from appointments.models import SupervisorAppointment, PanelAppointment
    from marks.models import EvaluationTask
    for row in config["accounts"]:
        user = User.objects.get(email=row["email"])
        if not user.check_password(row["password"]) or user.role != row["role"] or not user.is_active:
            raise RuntimeError(f"Account no longer matches initial fixture: {row['key']} (expected after lifecycle/password tests).")
        if row["role"] != User.TECHNICAL_ADMIN and (user.is_staff or user.is_superuser):
            raise RuntimeError("Portal UAT accounts must not have technical admin flags.")
        if row["role"] == User.Role.OFFICE_ADMIN and can_correct_marks(user) != row["marks_permission"]:
            raise RuntimeError("Office Marks permission boundary differs from fixture.")
    print(f"PASS: {len(config['accounts'])} account passwords, roles, active states, technical flags and Office Marks grants.")
    print(f"Sandbox: {config['database']}; semesters={AcademicSemester.objects.count()}, primary={SupervisorAppointment.objects.count()}, panel={PanelAppointment.objects.count()}, tasks={EvaluationTask.objects.count()}.")


def start(config):
    for port in (3003, 8003):
        with socket.socket() as listener:
            try:
                listener.bind(("127.0.0.1", port))
            except OSError as exc:
                raise RuntimeError(f"Port {port} is already in use. No process was stopped.") from exc
    node = shutil.which("node")
    vite = ROOT / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"
    if not node or not vite.is_file():
        raise RuntimeError("Node and installed frontend dependencies are required.")
    env = os.environ.copy()
    env.update(API_PORT="8003", VITE_USE_MOCKS="false", VITE_USE_REGISTRY_BACKEND="true",
               VITE_API_BASE_URL="/api", VITE_ENABLE_DEMO_LOGIN="false")
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    jobs = {}
    for name, command, cwd in [
        ("backend", [sys.executable, str(Path(__file__).resolve()), "--serve"], BACKEND),
        ("frontend", [node, str(vite), "--host", "127.0.0.1", "--port", "3003", "--strictPort"], ROOT / "frontend"),
    ]:
        with (PRIVATE / f"{name}.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
        jobs[name] = {"pid": process.pid, "command": command}
    (PRIVATE / "processes.json").write_text(json.dumps(jobs, indent=2) + "\n", encoding="utf-8")
    print(f"Started local UAT processes: backend PID {jobs['backend']['pid']}, frontend PID {jobs['frontend']['pid']}.")
    print(f"Portal: {config['portal_url']}; API: {config['api_url']}/api/health/")
    print("Check health/startup logs before use. PIDs are recorded in the private directory.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="Read-only verification of initial accounts; terminal tests may change them.")
    modes.add_argument("--serve", action="store_true", help="Run isolated Django at 127.0.0.1:8003 in the foreground.")
    modes.add_argument("--start", action="store_true", help="Start separate hidden local backend/frontend processes, without stopping any server.")
    args = parser.parse_args()
    if args.serve:
        configure(read_config())
        from django.core.management import execute_from_command_line
        execute_from_command_line(["manage.py", "runserver", "127.0.0.1:8003", "--noreload"])
    elif args.check:
        check(read_config())
    elif args.start:
        start(read_config())
    else:
        prepare()


if __name__ == "__main__":
    main()
