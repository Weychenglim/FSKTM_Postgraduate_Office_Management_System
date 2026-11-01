"""Spelling and grammar fixes for the FAQ entries imported from the office's
FAQ.pdf, by source reference: for each field, the wording as imported and the
proofread wording. A fix is applied only while the entry still has the
imported wording, so anything the office has written itself is kept.
Garbled and incomplete rows are left for the office to check.
"""

FIXES = {
    "admission-offer-letter-categorized-1": {
        "question": ("Entry Requirement", "What are the entry requirements?"),
    },
    "admission-offer-letter-categorized-10": {
        "question": ("are the admission fees refundable in case of withdrawal?", "Are the admission fees refundable if I withdraw?"),
        "answer": ("No", "No."),
    },
    "admission-offer-letter-categorized-2": {
        "question": ("Fees", "How much are the fees?"),
    },
    "admission-offer-letter-categorized-4": {
        "question": ("Can I get a discount for the fees if I pay in full?", "Can I get a discount on the fees if I pay in full?"),
        "answer": ("No", "No."),
    },
    "admission-offer-letter-categorized-5": {
        "answer": ("Within one month", "Within one month."),
    },
    "admission-offer-letter-categorized-6": {
        "answer": ("Through MAYA", "Through MAYA."),
    },
    "admission-offer-letter-categorized-7": {
        "question": ("Does the Faculty help to check my qualifications prior to my application", "Does the Faculty check my qualifications before I apply?"),
        "answer": ("No", "No."),
    },
    "all-all-36": {
        "question": ("Can I register for a master’s program without a bachelor’s degree in the same field?", "Can I register for a master's programme without a bachelor's degree in the same field?"),
    },
    "all-all-37": {
        "question": ("What happens after I received the offer?", "What happens after I receive the offer?"),
        "answer": ("Accept the offer and pay the admission fees RM1,000.00 within the 7 days", "Accept the offer and pay the admission fee of RM1,000.00 within 7 days."),
    },
    "all-all-39": {
        "question": ("I missed the dateline for the acceptance offer letter, what should i do?", "I missed the deadline to accept the offer letter. What should I do?"),
        "answer": ("Please email to application@um.edu.my", "Please email application@um.edu.my."),
    },
    "all-all-40": {
        "question": ("Can i defer my offer to a later intake?", "Can I defer my offer to a later intake?"),
        "answer": ("Yes, email to nurulain.nawi@um.edu.my (marketing department)", "Yes. Email nurulain.nawi@um.edu.my (Marketing Department)."),
    },
    "all-all-41": {
        "answer": ("No, you can apply visa after you received and accepted the offer letter", "No. You can apply for a visa after you have received and accepted the offer letter."),
    },
    "all-all-42": {
        "answer": ("For any matters related to tuition fees, please email your request to: bursar_student@um.edu.my cc tina_su@um.edu.my", "For any matter related to tuition fees, please email your request to bursar_student@um.edu.my, with tina_su@um.edu.my in copy."),
    },
    "all-all-43": {
        "question": ("If I have issue during registration period because of technical error, late payment received via flywire or scholarship pending approval, how do I appeal for late self enrol and modul registration?", "If I have a problem during the registration period because of a technical error, a late Flywire payment or a scholarship pending approval, how do I appeal for late self-enrolment and module registration?"),
        "answer": ("If students have any issue during registration and insufficient time to complete the registration, student may appeal for the late registration through MAYA.", "If you have a problem during registration and not enough time to complete it, you may appeal for late registration through MAYA."),
    },
    "all-all-44": {
        "answer": ("No", "No."),
    },
    "all-all-45": {
        "answer": ("Students can apply for National Higher Education Fund (PTPTN) education loans online at website PTPTN and Register", "You can apply for a National Higher Education Fund (PTPTN) education loan online by registering on the PTPTN website."),
    },
    "all-all-46": {
        "question": ("When I attempting to check the eligibility of this course for PTPTN funding through the official PTPTN portal, I noticed that the program does not appear in the course list. I would like to confirm whether the Master of Artificial Intelligence/ Master in Data Science is currently registered and eligible for PTPTN.", "When I checked this course's eligibility for PTPTN funding on the official PTPTN portal, the programme did not appear in the course list. Are the Master of Artificial Intelligence and the Master of Data Science registered and eligible for PTPTN?"),
        "answer": ("Please find Sarjana Kepintaran Buatan/ Sarjana Sains Data at portal PTPTN.", "On the PTPTN portal, look for Sarjana Kepintaran Buatan or Sarjana Sains Data."),
    },
    "all-all-47": {
        "question": ("Mode of Delivery: Is the program conducted online, in-person or in a hybrid format?", "Is the programme conducted online, in person or in a hybrid format?"),
    },
    "all-all-48": {
        "question": ("I am 56, may I eligible to apply?", "I am 56. Am I eligible to apply?"),
    },
    "all-all-49": {
        "question": ("Are there any language requirements, such as MUET? Is meeting the language requirement compulsory? Our degree was fully conducted in English, but we don't have a specific language certification.", "Are there any language requirements, such as MUET? Is meeting the language requirement compulsory? Our degree was taught fully in English, but we do not have a specific language certificate."),
        "answer": ("Malaysian: Not required International: Povide proof that your previous institution is teaching in English/separated letter endorse by University. For more information, please refer to the entry requirements", "Malaysian applicants: not required. International applicants: provide proof that your previous institution taught in English, or a separate letter endorsed by your university. For more information, please refer to the entry requirements."),
    },
    "all-all-50": {
        "question": ("How do I register courses for every semester?", "How do I register for courses every semester?"),
        "answer": ("Follow the timeline for registration (For each semester) Students register for courses through the website MAYA.", "Follow the registration timeline for each semester, and register for your courses on MAYA."),
    },
    "all-all-51": {
        "question": ("It seems to me that the program runs from 6pm to 9pm daily and on weekends too. I assume it is a full time program. Do you recommend someone who is working and attending the program at the same time? The time seems a bit tight, and I am wondering if that is still possible.", "It seems the programme runs from 6 pm to 9 pm daily and at weekends too, so I assume it is a full-time programme. Would you recommend it for someone who is working at the same time? The schedule seems tight, and I am wondering whether it is still possible."),
        "answer": ("The program is conducted after office hours to accommodate the needs of our students, most of whom are working professionals.", "The programme is conducted after office hours to suit our students, most of whom are working professionals."),
    },
    "all-all-53": {
        "question": ("As shown in the the MAYA portal indicates that my status is “Ready to Enrol\". However, it also states that the enrollment/registration period is closed. May I ask why this is happening? Did I miss the enrollment period or should I wait until orientation week to proceed with the next steps?", "The MAYA portal shows my status as \"Ready to Enrol\", but it also says the enrolment/registration period is closed. Why is this happening? Did I miss the enrolment period, or should I wait until orientation week to continue?"),
        "answer": ("The status \"Ready to Enrol\" is automatically generated for all students who accept the offer letter. You must register in early September and pay all the fees by early October (before the class starts). Then, the status will change to \"Active.\"", "The status \"Ready to Enrol\" is generated automatically for all students who accept the offer letter. You must register in early September and pay all the fees by early October (before classes start). The status will then change to \"Active\"."),
    },
    "all-all-54": {
        "question": ("What do I need to do if I wish to change programme/faculty/campus upon receiving the offer letter /before enrollment?", "What do I need to do if I wish to change my programme, faculty or campus after receiving the offer letter, before enrolment?"),
        "answer": ("It is not allowed to change programme after receiving the offer letter. To do so, candidate need to apply again for the programme that he/she is interested to change to.", "Changing programme after receiving the offer letter is not allowed. To change, you need to apply again for the programme you are interested in."),
    },
    "completion-graduation-categorized-1": {
        "question": ("Do we still have to register or pay in the coming semester once we submitted our thesis/dissertation (first draft)?", "Do we still have to register or pay in the coming semester once we have submitted our thesis or dissertation (first draft)?"),
        "answer": ("No need to register or pay. Please ensure that your status in Maya is EP (Examination Period)", "No, you do not need to register or pay. Please make sure your status in MAYA is EP (Examination Period)."),
    },
    "completion-graduation-categorized-2": {
        "answer": ("The examination committee will take about 2-3 months to make a decision (Major/Minor)", "The examination committee takes about 2 to 3 months to make a decision (major or minor corrections)."),
    },
    "completion-graduation-categorized-4": {
        "answer": ("Please refer to the website ASD", "Please refer to the ASD website."),
    },
    "course-registration-categorized-10": {
        "question": ("Is there anyway to pay my tuition fees with cash or a bank deposit", "Is there any way to pay my tuition fees in cash or by bank deposit?"),
        "answer": ("For payment instructions, please refer to the following link: https://bendahari.um.edu.my/guide-video-fees-payment .", "For payment instructions, please refer to the following link: https://bendahari.um.edu.my/guide-video-fees-payment"),
    },
    "course-registration-categorized-11": {
        "question": ("I'm Master of Coursework students. Am I allowed to take research methodology (WOX7001) together with P1 in same semester?", "I am a Master's by coursework student. Can I take Research Methodology (WOX7001) and P1 in the same semester?"),
        "answer": ("No.Students are only allowed to register for Research Project after completing at least three (3) core discipline courses (including WOX7001)", "No. Students may only register for the Research Project after completing at least three (3) core discipline courses (including WOX7001)."),
    },
    "course-registration-categorized-12": {
        "question": ("Scholarship?", "Are there scholarships?"),
        "answer": ("Funding Opportunities International applicants may refer to the financial aid options here: https://aasd.um.edu.my/financial-aid-for-postgraduate", "International applicants may refer to the financial aid options here: https://aasd.um.edu.my/financial-aid-for-postgraduate"),
    },
    "course-registration-categorized-13": {
        "question": ("Can you provide me with an acceptance letter? I need an acceptance letter before registration/enrollment.", "Can you provide me with an acceptance letter? I need an acceptance letter before registration/enrolment."),
    },
    "course-registration-categorized-15": {
        "question": ("I'm Master of Coursework students, can I take a break after i take P1, and not continue P2 in upcoming semester?", "I am a Master's by coursework student. Can I take a break after P1 and not continue with P2 in the next semester?"),
        "answer": ("No, P1 and P2 must be take in two consequtive semesters. Fail to complete it in 2 semester will be result in failing the module.", "No. P1 and P2 must be taken in two consecutive semesters. Not completing them within 2 semesters will result in failing the module."),
    },
    "course-registration-categorized-16": {
        "question": ("Can I pay the fee by intallment?", "Can I pay the fees in instalments?"),
        "answer": ("No", "No."),
    },
    "course-registration-categorized-17": {
        "question": ("Can I click Pay Later button?", "Can I use the Pay Later button?"),
    },
    "course-registration-categorized-3": {
        "question": ("hWahnadtb ioso tkh?e minimum total number of subjects that can be registered every semester?", "What is the minimum number of subjects I can register for each semester?"),
        "answer": ("There's no minimum or maximum number of subjects a student should take as this depends on their preference and capability to cope (the passing grade is a B), but we normally recommend students to take at least two subjects in each semester.", "There is no minimum or maximum number of subjects, as this depends on your preference and ability to cope (the passing grade is a B), but we normally recommend taking at least two subjects each semester."),
    },
    "course-registration-categorized-4": {
        "question": ("What subjects do I have to take to complete the program?", "What subjects do I have to take to complete the programme?"),
        "answer": ("The information can be found in the annual postgraduate handbook under the section for respective program. Please visit fsktm.um.edu.my/postgraduate.", "You can find this in the annual postgraduate handbook, in the section for your programme. Please visit fsktm.um.edu.my/postgraduate."),
    },
    "course-registration-categorized-5": {
        "answer": ("Refer to maya.um.edu.my", "Please refer to maya.um.edu.my."),
    },
    "course-registration-categorized-7": {
        "question": ("Can I apply for Exemption of BM course?", "Can I apply for an exemption from the BM course?"),
        "answer": ("Yes, BM (Bahasa Malaysia) courses from Malaysia public universities are accepted. You are required to attend BM course under UM before Graduation. If you need more details, you can check out their official website: https://fll.um.edu.my/malay-language", "Yes. BM (Bahasa Malaysia) courses from Malaysian public universities are accepted. Otherwise, you are required to take the BM course at UM before graduation. For more details, see the official website: https://fll.um.edu.my/malay-language"),
    },
    "course-registration-categorized-8": {
        "question": ("How can I apply for an exemption from the Malay Language requirement?", "How can I apply for an exemption from the Malay language requirement?"),
        "answer": ("Please obtain the application form from the link : APPLICATION FOR EXEMPTION FROM THE BAHASA MALAYSIA LANGUAGE REQUIREMENT", "Please obtain the form \"Application for Exemption from the Bahasa Malaysia Language Requirement\"."),
    },
    "course-registration-categorized-9": {
        "answer": ("Modifications are not permitted as you have already reached the fourth step, which is generative Invoice", "Changes are not allowed once you have reached the fourth step, which is generating the invoice."),
    },
    "during-semester-categorized-1": {
        "answer": ("For your information, Master students are not required to undergo an internship. The faculty will only issue a letter confirming your student status if needed. Please fill up this form to request a Confirmation Letter. We will review and process the application within three (3) to five (5) working days. \"Universiti Malaya shall not be held responsible for any claims, liabilities, or issues arising from the student's internship placement, as the Master in Data Science programme does not include internship as part of its programme requirements\"", "Master's students are not required to do an internship. If needed, the faculty will issue a letter confirming your student status: please fill in this form to request a Confirmation Letter, and we will process it within three (3) to five (5) working days.\n\n\"Universiti Malaya shall not be held responsible for any claims, liabilities or issues arising from the student's internship placement, as the Master of Data Science programme does not include an internship as part of its programme requirements.\""),
    },
    "during-semester-categorized-10": {
        "question": ("Can I withdraw from semester for personal reasons?", "Can I withdraw from a semester for personal reasons?"),
        "answer": ("Yes. A student is only allowed to withdraw from a semester after he has undergone at least one semester", "Yes, but only after you have completed at least one semester."),
    },
    "during-semester-categorized-12": {
        "question": ("How do I apply for University/ Programme withdrawal?", "How do I apply to withdraw from the University or my programme?"),
        "answer": ("Students can submit the University/ Programme Withdrawal through the website MAYA.", "Submit your University/Programme Withdrawal application through MAYA."),
    },
    "during-semester-categorized-13": {
        "question": ("Can I reapply for the same programme if I was quit or failed or terminated before?", "Can I reapply for the same programme if I previously quit, failed or was terminated?"),
        "answer": ("Yes. For research mode programme, student may apply for the same program but in different field of research and supervisor (s). However the university has the right to accept the readmission or ortherwise. Should his application is successful he shall not be entitled for any credit transfer.", "Yes. For research-mode programmes, you may apply for the same programme, but in a different field of research and with different supervisor(s). The University may accept or refuse the readmission. If your application is successful, you will not be entitled to any credit transfer."),
    },
    "during-semester-categorized-2": {
        "answer": ("Please obtain it from the website https://fsktm.um.edu.my/forms-and-templates. Please ensure that your application form has been verified by your supervisor, and the completed form must be emailed to ani_e@um.edu.my, before the fifth week of each semester", "Please download it from https://fsktm.um.edu.my/forms-and-templates. Make sure your supervisor has verified the form, then email the completed form to ani_e@um.edu.my before the fifth week of the semester."),
    },
    "during-semester-categorized-3": {
        "answer": ("Please refer to our website : https://fsktm.um.edu.my/forms-and-templates", "Please refer to our website: https://fsktm.um.edu.my/forms-and-templates"),
    },
    "during-semester-categorized-4": {
        "answer": ("Please refer to our website : https://fsktm.um.edu.my/forms-and-templates", "Please refer to our website: https://fsktm.um.edu.my/forms-and-templates"),
    },
    "during-semester-categorized-5": {
        "question": ("How to Change of Supervisor?", "How do I change my supervisor?"),
        "answer": ("You are only allowed to change the Supervisor before CD. Complete the Form and send to TDIT office. We will notified you once Faculty Meeting approved.", "You may only change your supervisor before CD. Complete the form and send it to the TDIT office. We will notify you once the Faculty Meeting has approved it."),
    },
    "during-semester-categorized-6": {
        "question": ("How to add Co-Supervisor?", "How do I add a co-supervisor?"),
        "answer": ("You are only allowed to change the Co-Supervisor before CD. Complete the Form and send to TDIT office. We will notified you once Faculty Meeting approved.", "You may only add or change a co-supervisor before CD. Complete the form and send it to the TDIT office. We will notify you once the Faculty Meeting has approved it."),
    },
    "during-semester-categorized-7": {
        "question": ("How to change Field of Research?", "How do I change my field of research?"),
        "answer": ("You are only allowed to change the field of research before submission of thesis/disertation.Complete the Form and send to TDIT office. We will notified you once Faculty Meeting approved.", "You may only change your field of research before submitting your thesis or dissertation. Complete the form and send it to the TDIT office. We will notify you once the Faculty Meeting has approved it."),
    },
    "during-semester-categorized-8": {
        "question": ("Can I appeal for extension of the maximum period of study?", "Can I appeal for an extension of the maximum period of study?"),
        "answer": ("Yes. Please contact TDIT office to Appeal to Extend Maximum Period of Candidature at least before 1 semester expired.", "Yes. Please contact the TDIT office to appeal for an extension of the maximum period of candidature, at least one semester before it expires."),
    },
    "during-semester-categorized-9": {
        "question": ("How do I apply for withdrawal from semester on medical reasons?", "How do I apply to withdraw from a semester on medical grounds?"),
        "answer": ("Application for withdrawal from a semester on medical reasons must be supported by a medical report issued by a Registered Medical Practitioner from the University Student Health Clinic/Government Hospital/University of Malaya Medical Centre/Teaching Hospital/Private Medical Centre or relevant documentary proof. Applications must be made through the website MAYA.", "An application to withdraw from a semester on medical grounds must be supported by a medical report from a registered medical practitioner at the University Student Health Clinic, a government hospital, University of Malaya Medical Centre, a teaching hospital or a private medical centre, or by other relevant documentary proof. Applications must be made through MAYA."),
    },
    "rp-dissertation-thesis-categorized-1": {
        "answer": ("Refer to FSKTM website > Student > Postgraduate > RP & Dissertation.", "Refer to the FSKTM website > Student > Postgraduate > RP & Dissertation."),
    },
    "rp-dissertation-thesis-categorized-2": {
        "question": ("Some PhD programs have requirements that aren't stated in the basic criteria when registering; suddenly, there are unwritten requirements. For example, needing 80,000 words, even though there are theses that don't need to reach 80,000 words because they are technical theses", "Some PhD programmes seem to have requirements that are not stated when registering, such as needing 80,000 words, even though technical theses may not need to reach 80,000 words. What is the required length?"),
        "answer": ("the maximum minimum refer website", "Please refer to the website for the minimum and maximum length."),
    },
    "rp-dissertation-thesis-categorized-3": {
        "answer": ("Please refer to our website : https://fsktm.um.edu.my/guidelines-and-policies", "Please refer to our website: https://fsktm.um.edu.my/guidelines-and-policies"),
    },
    "rp-dissertation-thesis-categorized-4": {
        "question": ("How to submit First Submission For Examination?", "How do I make my first submission for examination?"),
        "answer": ("Please visit to https://fsktm.um.edu.my/examination", "Please visit https://fsktm.um.edu.my/examination"),
    },
    "rp-dissertation-thesis-categorized-5": {
        "question": ("After Board Examiner Session, what shoud I do?", "What should I do after the Board of Examiners session?"),
        "answer": ("Refer to the Board of Examiner session result. Please visit to https://fsktm.um.edu.my/examination", "Refer to the result of the Board of Examiners session, and visit https://fsktm.um.edu.my/examination"),
    },
    "rp-dissertation-thesis-categorized-6": {
        "question": ("When can i submit my thesis/disertation?", "When can I submit my thesis or dissertation?"),
        "answer": ("Master by Research = 2nd Semester (with completion research methodology and BM) Master by Mixed Mode = 3rd Semester (with completion of courses, BM and CGPA 3.0 and above) PhD = 4th Semester (with completion research methodology and BM)", "- Master's by research: from the 2nd semester (after completing Research Methodology and BM).\n- Master's by mixed mode: from the 3rd semester (after completing your courses and BM, with a CGPA of 3.0 or above).\n- PhD: from the 4th semester (after completing Research Methodology and BM)."),
    },
    "student-application-categorized-12": {
        "answer": ("We do not offer an official part-time mode for the programme. However, students have the choice to plan their schedule as long as they complete within 8 semesters (maximum duration of the study).", "We do not offer an official part-time mode for the programme. However, students can plan their own schedule, as long as they complete the programme within 8 semesters (the maximum duration of study)."),
    },
    "student-application-categorized-13": {
        "answer": ("Generally, classes are conducted during weekdays from 6.00 pm - 9.00 pm. Weekend from 8.00 am - 6.00 pm.", "Generally, classes run on weekdays from 6.00 pm to 9.00 pm, and at weekends from 8.00 am to 6.00 pm."),
    },
    "student-application-categorized-14": {
        "answer": ("This depends on the number of courses you register in a semester.", "This depends on the number of courses you register for in a semester."),
    },
    "student-application-categorized-15": {
        "answer": ("Please refer to the portal of Student Affairs Division at https://hep.um.edu.my/accommodation", "Please refer to the Student Affairs Division portal at https://hep.um.edu.my/accommodation"),
    },
    "student-application-categorized-17": {
        "answer": ("Please refer to the portal of International Student Services Unit at https://aasd.um.edu.my/new-student-pass-overview Visa Unit UM can be contacted via email at visa@um.edu.my", "Please refer to the International Student Services Unit portal at https://aasd.um.edu.my/new-student-pass-overview. You can also email the UM Visa Unit at visa@um.edu.my."),
    },
    "student-application-categorized-2": {
        "question": ("How can I know that I am accepted to UM?", "How do I know if I have been accepted to UM?"),
        "answer": ("Please check your MAYA from time to time and application processing will take 4 - 8 weeks. All successful applicants will be notified via MAYA.", "Please check MAYA from time to time. Processing an application takes 4 to 8 weeks, and all successful applicants are notified through MAYA."),
    },
    "student-application-categorized-22": {
        "question": ("I am looking at the Master of Artificial Intelligence (coursework) at Universiti Malaya. I noticed the program needs the candidates to have backgrounds in Computer Science or Information Technology. Does it consider someone with an engineering background for the application?", "I am interested in the Master of Artificial Intelligence (coursework) at Universiti Malaya. The programme requires a background in Computer Science or Information Technology. Will an applicant with an engineering background be considered?"),
    },
    "student-application-categorized-23": {
        "question": ("How do I apply for the program?", "How do I apply for the programme?"),
        "answer": ("You can apply here https://study.um.edu.my/", "You can apply at https://study.um.edu.my/"),
    },
    "student-application-categorized-24": {
        "question": ("The typical challenges students face during the programme.", "What are the typical challenges students face during the programme?"),
    },
    "student-application-categorized-25": {
        "question": ("The kind of technical readiness (e.g. programming, math, machine learning) expected at the start of Master of Artificial Intelligence", "What technical background (for example programming, maths or machine learning) is expected at the start of the Master of Artificial Intelligence?"),
        "answer": ("A basic foundation in programming (preferably Python) and comfort with mathematics (linear algebra, probability, and calculus) is important. Students without this background tend to struggle more initially, but it’s possible to catch up with dedication and the right resources.", "A basic foundation in programming (preferably Python) and comfort with mathematics (linear algebra, probability and calculus) are important. Students without this background tend to struggle more at first, but it is possible to catch up with dedication and the right resources."),
    },
    "student-application-categorized-26": {
        "question": ("Whether there is academic or peer support available for students who may need additional help,", "Is there academic or peer support for students who need additional help?"),
    },
    "student-application-categorized-27": {
        "question": ("And any advice you might have for prospective students to prepare in advance for Master of Artificial intelligence", "What advice do you have for prospective students preparing for the Master of Artificial Intelligence?"),
        "answer": ("Learn basic Python programming through free platforms, review math for machine learning (there are many beginner-friendly resources available), explore introductory AI or ML courses, such as Andrew Ng’s course on Coursera.", "Learn basic Python programming through free platforms, review the maths used in machine learning (there are many beginner-friendly resources), and explore introductory AI or ML courses, such as Andrew Ng's course on Coursera."),
    },
    "student-application-categorized-28": {
        "answer": ("Candidates can get the information on the https://study.um.edu.my/", "You can find this information at https://study.um.edu.my/"),
    },
    "student-application-categorized-3": {
        "answer": ("A complete online application should have: Recent passport-size photographs with a blue background; Certified copies of passport (first page only - photo, owner details and validity)/ Identity Card; Certified copies of Sijil Pelajaran Malaysia (SPM), academic certificate with detailed academic transcripts/results for Higher School Certificate (HSC) , Grade 12 or GCE (A' Level) or Diploma from recognized Institutions. Official translation is needed for applicants whose native language is not English or Malay; Certified copies of TOEFL/IELTS or other equivalent examinations indicating English proficiency (if available); A letter of guarantee from the sponsor for sponsored students;", "A complete online application should include:\n- recent passport-size photographs with a blue background;\n- certified copies of your passport (first page only: photo, owner details and validity) or identity card;\n- certified copies of your Sijil Pelajaran Malaysia (SPM) and academic certificates, with detailed transcripts or results for the Higher School Certificate (HSC), Grade 12, GCE A Level or a diploma from a recognised institution (an official translation is needed if your native language is not English or Malay);\n- certified copies of TOEFL, IELTS or an equivalent examination showing your English proficiency (if available);\n- a letter of guarantee from your sponsor, for sponsored students."),
    },
    "student-application-categorized-4": {
        "question": ("Who can certify the above documents?", "Who can certify my application documents?"),
        "answer": ("The documents must be certified by: The School Principal, Government Officers or Commissioner of Oath. Respective embassy", "The documents must be certified by a school principal, a government officer, a Commissioner for Oaths or your country's embassy."),
    },
    "student-application-categorized-5": {
        "question": ("How much processing fees should I pay for an application? How can I pay?", "How much is the application fee, and how can I pay it?"),
        "answer": ("The application fee is RM 50.00 per application for Malaysian and RM300 per application for non-Malaysian/ International. It should be paid using FPX, Credit/Debit Card, and Flywire before submitting an application.", "The application fee is RM50.00 per application for Malaysian applicants and RM300.00 for international applicants. Pay it by FPX, credit or debit card, or Flywire before you submit your application."),
    },
    "student-application-categorized-6": {
        "question": ("If my application was unsuccessful, how do I know the reason of the rejection? only for Master (coursework) & Mixmode.", "If my application was unsuccessful, how can I find out why? (Master's by coursework and mixed mode only)"),
        "answer": ("If your application was rejected and you want to know the reason, you may email to Marketing Centre, application@um.edu.my", "If your application was rejected and you would like to know why, email the Marketing Centre at application@um.edu.my."),
    },
    "student-application-categorized-7": {
        "question": ("May I appeal my unsuccesful application? Only for Master (coursework)", "May I appeal against an unsuccessful application? (Master's by coursework only)"),
        "answer": ("Yes you may appeal your application by sending an email to Admission and Registration Centre bkp_aasd@um.edu.my with complete justification and attachments.", "Yes. Email the Admission and Registration Centre at bkp_aasd@um.edu.my with your full justification and supporting attachments."),
    },
    "student-application-categorized-8": {
        "question": ("Do I need to study Malay language?", "Do I need to study the Malay language?"),
        "answer": ("All International students accepted into any program will also be required to undergo a course in the Malay language (local language) during their studies in UM prior to completion of their programme.", "All international students accepted into any programme must take a Malay language course during their studies at UM, before they complete their programme."),
    },
    "student-application-categorized-9": {
        "question": ("What is the official duration of the PhD and Master’s?", "What is the official duration of the PhD and Master's programmes?"),
        "answer": ("Master coursework: Minimum 3 semester (Including 1 Short semester), Maximum 8 Semester Master Mixmode: Minimum 3 semester, Maximum 8 Semester Master by Research: Minimum 2 semester, Maximum 8 Semester PhD: Minimum 4 semester, maximum 12 semester", "- Master's by coursework: minimum 3 semesters (including 1 short semester), maximum 8 semesters.\n- Master's by mixed mode: minimum 3 semesters, maximum 8 semesters.\n- Master's by research: minimum 2 semesters, maximum 8 semesters.\n- PhD: minimum 4 semesters, maximum 12 semesters."),
    },
}


def proofread(source_ref, field, text):
    """The proofread wording for an imported field, or the text unchanged."""
    imported, fixed = FIXES.get(source_ref, {}).get(field, (None, None))
    return fixed if text == imported else text


def apply_fixes(entries):
    """Proofread the stored entries; returns the entries changed, with their fields."""
    changed = []
    for entry in entries.filter(source_ref__in=FIXES):
        fields = [field for field in FIXES[entry.source_ref] if proofread(entry.source_ref, field, getattr(entry, field)) != getattr(entry, field)]
        if not fields:
            continue
        for field in fields:
            setattr(entry, field, proofread(entry.source_ref, field, getattr(entry, field)))
        entry.save(update_fields=[*fields, "updated_at"])
        changed.append((entry, fields))
    return changed
