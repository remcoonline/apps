# Service Agreement — merge-field skeleton

**This is a structural skeleton for building your DocuSign template, not a legal document.** Have actual contract language drafted/reviewed by counsel before sending it to a single client. What matters for the automation is the merge-field names below matching exactly what Zap 1 sends.

---

**SERVICE AGREEMENT**

This Agreement is entered into between **{{company_legal_name}}** ("Agency") and **{{client_name}}** / **{{company}}** ("Client"), effective as of the date of signature below.

## 1. Services

Agency will provide: **{{service_package}}**, as described in Exhibit A.

## 2. Fees

Total price: **{{price}}**
Payment terms: **{{payment_terms}}**
Invoice will be sent upon signature and is due **{{payment_due}}**.

## 3. Term

This Agreement begins on **{{start_date}}** and continues **{{term_length}}**, unless terminated per Section 5.

## 4. Point of Contact

Agency account team: **{{account_manager}}** (Account Manager), **{{strategist}}** (Strategist), **{{fulfillment_lead}}** (Fulfillment Lead).

## 5. Termination

[Standard termination clause — counsel to draft.]

## 6. Confidentiality / IP / Liability

[Standard clauses — counsel to draft.]

## Signature

Client: ___________________________  Date: ___________
{{client_name}}, {{company}}

Agency: ___________________________  Date: ___________
{{company_legal_name}}

---

### Merge fields Zap 1 must supply

`company_legal_name` (static — your agency), `client_name`, `company`, `service_package`, `price`, `payment_terms`, `payment_due`, `start_date`, `term_length`, `account_manager`, `strategist`, `fulfillment_lead`.
