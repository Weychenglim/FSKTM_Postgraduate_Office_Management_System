# Non-functional requirements evidence

Checked on 19 November 2026 using synthetic records.

| Requirement | Observed result | Coverage |
|---|---|---|
| NFR-01 · Feedback timing | Chrome displayed the “Draft saved.” toast 12.1 ms after the browser fixture returned the successful save response. | One successful save against a simulated response. Create, update, approve, reject, submit, upload, delete, and error-toast timing still need coverage. |
| NFR-02 · Role-based access | All three targeted Django API tests passed. The frontend permissions test passed. | Marks administration access and ownership of marking tasks. |
| NFR-03 · Browser compatibility | The supervisor form loaded, opened the supervisor picker, and saved the draft in Chrome 158.0.8127.36 and Edge 157.0.4341.60. No horizontal overflow was detected in either capture. | One desktop workflow using synthetic API responses. Full workflow coverage and latest-stable certification remain open. |

## NFR-02 · API test results

| Actor and action | Observed result |
|---|---|
| Office Staff/Admin opens Marks assignment options | HTTP 200 with the expected assignment data |
| Lecturer opens Marks period administration or assignment options | HTTP 403 on both endpoints |
| Unassigned lecturer lists or edits another lecturer’s evaluation task | Task absent from the list. Draft update returned HTTP 404. |

## Screenshots

- [Chrome · Draft saved toast](draft-save-chrome.png)
- [Edge · Same supervisor workflow](draft-save-edge.png)

The Chrome timing used the browser’s real clock and measured from the fixture response to the toast entering the DOM. The Edge capture used browser virtual time for the smoke check. Only the Chrome run supplied the timing result above.
