"""Offline safeguards for the local-only UAT account bootstrap."""
import importlib.util
from pathlib import Path
import unittest


class UatPreparationGuards(unittest.TestCase):
    def helper(self):
        path = Path(__file__).with_name("prepare_five_module_uat.py")
        self.assertTrue(path.is_file(), "The isolated UAT bootstrap is not implemented yet")
        spec = importlib.util.spec_from_file_location("uat_bootstrap", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_accepts_only_local_sandbox_database(self):
        helper = self.helper()
        helper.validate_target("fsktm_uat_20261028_a1b2c3", "localhost")
        helper.validate_target("fsktm_uat_20261028_a1b2c3", "127.0.0.1")
        for name, host in [
            ("fsktm_pg_office", "localhost"),
            ("postgres", "localhost"),
            ("test_production", "localhost"),
            ("fsktm_uat_20261028_a1b2c3", "database.example.test"),
            ("fsktm_uat_20261028_a1b2c3; DROP DATABASE postgres", "localhost"),
        ]:
            with self.subTest(name=name, host=host), self.assertRaises(ValueError):
                helper.validate_target(name, host)

    def test_credentials_can_only_be_written_to_ignored_private_directory(self):
        helper = self.helper()
        helper.validate_private_directory(helper.PRIVATE)
        for path in [helper.ROOT / "docs", helper.ROOT, helper.ROOT / "backend" / ".env.five-module-uat" / ".."]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                helper.validate_private_directory(path)

    def test_account_matrix_has_distinct_actors_and_sacrificial_students(self):
        specs = self.helper().account_specs()
        self.assertEqual(len(specs), 31)
        self.assertEqual(len({item['email'] for item in specs}), len(specs))
        self.assertEqual(len({item['id'] for item in specs}), len(specs))
        self.assertTrue(all(item['email'].endswith('@example.test') for item in specs))
        by_key = {item['key']: item for item in specs}
        self.assertEqual(by_key['coord-ai']['programme'], 'MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)')
        self.assertNotEqual(by_key['coord-ai']['programme'], by_key['coord-ds']['programme'])
        self.assertTrue(by_key['office']['marks_permission'])
        self.assertFalse(by_key['office-view']['marks_permission'])
        self.assertEqual(by_key['capacity']['supervisor'], 1)
        self.assertNotEqual(by_key['student-main']['id'], by_key['student-withdraw']['id'])

    def test_lecturers_cover_same_and_cross_department_scenarios(self):
        specs = self.helper().account_specs()
        by_key = {item['key']: item for item in specs}
        lecturers = [item for item in specs if item['role'] == 'Lecturer']
        self.assertEqual(len({item['department'] for item in lecturers}), 3)
        self.assertEqual(by_key['primary']['department'], by_key['support']['department'])
        self.assertNotEqual(by_key['primary']['department'], by_key['outsider']['department'])
        self.assertNotEqual(by_key['primary']['department'], by_key['panel']['department'])
        self.assertNotEqual(by_key['panel']['department'], by_key['panel-new']['department'])
        self.assertEqual(by_key['primary']['department'], by_key['coord-ai']['department'])


if __name__ == '__main__':
    unittest.main()
