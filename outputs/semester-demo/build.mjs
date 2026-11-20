import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const w=Workbook.create(); const s=w.worksheets.add('Timeline');
const rows=[
['Level','Title','Detail','Action','Deadline Start','Deadline End','Target Roles'],
['P1','Download research project forms','Download the supervisor appointment and title confirmation form and Research Intent from https://fsktm.um.edu.my/postgraduate.','Student / Supervisor','2026-11-06','2026-11-12','STUDENT,LECTURER'],
['P1','Submit supervisor appointment and research intent forms','Submit both forms through the programme Google Form. Obtain supervisor signatures first. Title and supervisor appointment require Faculty approval before starting the project.','Student / Supervisor','2026-11-06','2026-11-12','STUDENT,LECTURER'],
['P1','Communicate application decision','TDIT Office informs students and supervisors of the decision on the submitted forms by email.','TDIT Office','2026-11-26','2026-11-26','OFFICE_STAFF,STUDENT,LECTURER'],
['P1','Nominate internal examiner','Supervisor nominates an internal examiner (panel).','Student / Supervisor / Examiner','2026-12-18','2027-01-07','STUDENT,LECTURER'],
['P1','Proposal presentation','Research Project 1 proposal presentation.','Student / Supervisor / Examiner','2027-01-22','2027-02-25','STUDENT,LECTURER'],
['P1','Marks entry','Office will provide the marks entry link by email. DEMO DATE: source does not specify a deadline; confirm dates.','Supervisor / Examiner','2027-02-25','2027-02-25','LECTURER'],
['P2','Final presentation','Research Project 2 final presentation.','Student / Supervisor / Examiner','2027-01-22','2027-02-11','STUDENT,LECTURER'],
['P2','Submit final research report','After the presentation, submit the finalized report signed by the supervisor to the supervisor and upload it via the programme Google Form. DEMO DATE: source does not specify a deadline; confirm dates.','Student / Supervisor','2027-02-11','2027-02-11','STUDENT,LECTURER'],
['P2','Marks entry','Office will provide the marks entry link by email.','Student / Examiner','2027-01-22','2027-02-18','STUDENT,LECTURER']];
s.getRange('A1:G10').values=rows;
s.getRange('A1:G1').format.fill='#173454'; s.getRange('A1:G1').format.font.color='#FFFFFF'; s.getRange('A1:G1').format.font.bold=true;
s.getRange('A1:G10').format.wrapText=true; s.getRange('A1:G1').format.rowHeight=28; s.getRange('A2:G10').format.rowHeight=75;
for(const [col,width] of [['A',12],['B',30],['C',70],['D',28],['E',18],['F',18],['G',30]]) s.getRange(`${col}:${col}`).format.columnWidth=width;
s.getRange('A7:G7').format.fill='#FFF2CC'; s.getRange('A9:G9').format.fill='#FFF2CC';
const n=w.worksheets.add('Instructions'); n.getRange('A1:B7').values=[['DEMO — Semester I, 2026/2027',''],['Source','UAT active semester: 2026-10-30 to 2027-06-01. Event dates are illustrative, adapted from source week numbers (week 1 starts 30 October); confirm before use.'],['Placeholder dates','P1 marks entry and P2 final report have no deadline in the source. Their dates are illustrative and must be confirmed.'],['Programme forms','The screenshots show programme-specific Google Form links but their URLs are not visible. Add the correct URLs when known.'],['Import','Upload the Timeline sheet as an .xlsx for the matching semester. Review dates, roles and events in preview before confirming.'],['Role mapping','Supervisor and examiner are represented by LECTURER; target roles are demo visibility choices.'],['Operational windows','Import creates calendar entries only; configure submission or evaluation windows separately.']]; n.getRange('A:A').format.columnWidth=25;n.getRange('B:B').format.columnWidth=95;n.getRange('A1:B7').format.wrapText=true;n.getRange('A1:B7').format.rowHeight=48;n.getRange('A1:B1').format.fill='#173454';n.getRange('A1:B1').format.font.color='#FFFFFF';n.getRange('A1:B1').format.font.bold=true;
const out=await SpreadsheetFile.exportXlsx(w);await out.save('outputs/semester-demo/demo-semester-timeline.xlsx');

