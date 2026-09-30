# R1 evidence subset: source review

Reviewed 2026-10-01 for the Issue #2 evidence-library seed. This is a small set of claims from one first-party publication, chosen to cover Environment, Belong, and Community. “Source-reviewed” here means checked against the cited public source for accurate display in this prototype; it does not mean AMF1 endorsed the app or independently assured every claim.

## Source publication

- **Publisher:** Aston Martin Aramco Formula One™ Team
- **Title / edition:** *Make A Mark ESG Report 2024* (the report calls itself the team’s first annual Make A Mark ESG report)
- **Publication date:** No day/month publication date is printed in the PDF. “2024” is the report edition, not a verified publication date.
- **Report period:** 1 January 2023–31 December 2024 (Appendix, Materiality Assessment, printed p. 88).
- **Public source:** [Download the official report (PDF)](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf)
- **Review basis:** Inspected the official PDF and the cited passages/footnotes. The report’s limited assurance statement says THG Eco and MyCarbon verified the corporate GHG inventory for calendar 2024 at limited assurance and explicitly says no verification procedures were performed on the report (printed p. 89). Do not describe the three records below as independently assured.

## Candidate records

### ENV-2024-SOLAR-GENERATION — Environment

- **Claim type:** Measured operational output (electricity generated); annual value.
- **Claim wording:** The report states “779,682.30 kWh of renewable solar energy generated” for 2024. In the main text/graphic it labels this as renewable solar energy generated “IN 2024.”
- **Value / unit:** 779,682.30 kWh.
- **Reporting period:** Calendar year 2024. The report overall covers 2023–2024; this individual figure is explicitly labelled 2024.
- **Source title / edition / date:** *Make A Mark ESG Report 2024*; edition 2024; exact publication date not printed.
- **Source location:** Printed p. 26 (report PDF page 25), “Green Energy”; footnote 14 on printed p. 93 identifies the exact value and says the data was supplied by the solar panel provider.
- **Source URL:** [Official report PDF](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf)
- **Review status:** Source-reviewed for factual display.
- **Review note and limits:** The report attributes the data to its solar panel provider. This is generation, not total energy use, avoided emissions, or a whole-team renewable-energy percentage. The 81% REGO-backed renewable-electricity claim shown nearby is a separate claim and should not be substituted for this value. The report-level limited assurance statement covers the corporate GHG inventory only; this solar generation figure is not said to be independently assured.

### BEL-2023-NATIONALITIES — Belong

- **Claim type:** Workforce representation (count of nationalities represented).
- **Claim wording:** “23 nationalities represented within Aston Martin Aramco Formula One™ Team.”
- **Value / unit:** 23 nationalities.
- **Reporting period:** 2023 DE&I Survey, as specified by footnote 24. This is a survey/source year, distinct from the report’s overall 2023–2024 period.
- **Source title / edition / date:** *Make A Mark ESG Report 2024*; edition 2024; exact publication date not printed. Underlying source is identified as “Data collected through our DE&I Survey 2023.”
- **Source location:** Printed p. 60 (report PDF page 59) under “DE&I Survey and Reporting Data”; footnote 24 on printed p. 93.
- **Source URL:** [Official report PDF](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf)
- **Review status:** Source-reviewed for factual display.
- **Review note and limits:** The report supplies the count and identifies its 2023 DE&I Survey, but does not state the survey response rate, workforce denominator, or whether “nationalities represented” was derived from survey responses or a separate team roster. Display it as the report’s reported representation count; do not imply survey representativeness, nationality balance, or a change over time.

### COM-2024-MAKE-A-MARK-DAY — Community

- **Claim type:** Programme reach / participation (reported count threshold).
- **Claim wording:** The report says it “Expanded Make A Mark Day during British Grand Prix week, reaching and inspiring more than 300 students to pursue STEM careers within the fast-paced world of F1®.”
- **Value / unit:** More than 300 students (threshold phrasing; no exact count supplied).
- **Reporting period:** 2024. The overview statement appears in the 2024 report; the detailed account says the programme was widened to two full days “In 2024.”
- **Source title / edition / date:** *Make A Mark ESG Report 2024*; edition 2024; exact publication date not printed.
- **Source location:** Printed p. 12 (report PDF page 11), “Community” overview; detail on printed p. 68 (PDF page 67), “Engaging the Future of Motorsport.”
- **Source URL:** [Official report PDF](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf)
- **Review status:** Source-reviewed for factual display.
- **Review note and limits:** The report attributes the activity and reach to the team, and details two days of workshops and careers sessions for university and secondary-school students. It gives no count methodology, attendance list, unique-participant definition, or measured evidence that students subsequently pursued STEM careers. Preserve “more than 300” and the report’s attribution; do not convert “reaching and inspiring” into a measured career outcome.

## Dataset notes for implementation

- Keep the exact source claim, numeric value (if present), unit, period, and source location as separate fields.
- Store the evidence period at the claim level: 2024 generation, 2023 survey, and 2024 programme reach. Do not replace these with the report’s overall 2023–2024 coverage window.
- Link each record directly to the official report, with the printed page and footnote shown in the record detail.
- Phrase the app’s review state as “source-reviewed for this prototype.” Do not use “AMF1-approved” or imply independent assurance of all ESG report content.
- A later edition may supersede these records. Recheck the source and period before updating any value or carrying a record forward.
