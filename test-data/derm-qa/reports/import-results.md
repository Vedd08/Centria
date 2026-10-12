# Import results — [TEST DATA] derm-qa → isolated QA environment

Verified by reading back through the application's API (`tools/verify.mjs`) on 2026-10-12 08:34 UTC.
Environment: `test-data/derm-qa/runtime/qa-derm.db`, backend http://localhost:4100. Your `dev.db` was not touched.

**19/23 checks match the dataset.** Failures below are findings about the application (the dataset was validated separately — see `reconciliation.md`).

## 1. Read-back checks
| Area | Check | Result | Detail |
| --- | --- | --- | --- |
| Counts | Patients | PASS | 50/50 |
| Counts | Patients carry e-mail (sent on import) | **FAIL** | 0/50 have e-mail — defect if 0 |
| Counts | Staff accounts (incl. bootstrap admin) | PASS | 15/15 |
| Counts | Appointments by status | PASS | app {"Completed":64,"No-Show":5,"Cancelled":6,"Scheduled":35} · expected {"Completed":64,"Scheduled":35,"Cancelled":6,"No-Show":5} |
| Counts | Queue encounters in window | PASS | 94/94 |
| Counts | Live queue on 2026-10-12 | PASS | {"WITH_DOCTOR":1,"WAITING":3,"AWAITING_SERVICE":1,"CANCELLED":1} |
| Counts | Day-book visits (window + 8 historical + live assessed) | PASS | 103 |
| Billing | App bill totals = expected app formula | PASS | 143 bills |
| Billing | App bill totals = correct business rule | **FAIL** | 34 bills differ, overcharge ₹1,00,642.64 (package re-charge + undispensed medicines) |
| Billing | Payment status per bill | PASS | 0 mismatches |
| Billing | Payment mode + details per paid bill | PASS | 0 mismatches |
| GST | Every expected invoice exists with matching value, total and date | PASS | 108 invoices |
| GST | No extra invoices in the app | PASS | app 108 vs expected 108 |
| GST | Invoice numbers unique | PASS | INV-2026-0001 … INV-2026-0108 |
| GST | GSTR-1 test totals rebuilt from app invoices = expected | PASS | taxable ₹4,00,065.00 vs ₹4,00,065.00; exempt ₹1,38,531.00 vs ₹1,38,531.00 |
| Packages | Package sales, discounts and sittings used | PASS | 18 purchases |
| Stock | Closing stock per medicine | **FAIL** | M24 app 76 vs 98; M26 app 1 vs 10 |
| Stock | Gap fully explained by MAR "Given" doses deducting stock a second time | PASS | M26: 9 doses, M24: 22 doses |
| Stock | Batch quantities match correct FEFO (no expired batch dispensed) | **FAIL** | CET-A1 app 10 vs 20; PCM-A1 app 0 vs 1; CEF-B1 app 1 vs 10; PCM-A2 app 79 vs 100; CET-A2 app 60 vs 50 |
| IPD | Admissions imported with expected status (blocked case not admitted) | PASS | 3 admissions |
| IPD | Progress notes | PASS | 18/18 |
| IPD | Medication administrations (MAR) | PASS | 36/36 |
| Documents | Placeholder documents uploaded | PASS | 67/67 |

## 2. Probe and scenario outcomes
| Probe | Expected | App outcome | Message |
| --- | --- | --- | --- |
| CANCELLED_INVOICE | — | issued INV-2026-0001 with ₹8000, hard-deleted, re-issued |  |
| INVOICE_NUMBER_REUSE | cancelled number never reused | REUSED INV-2026-0001 |  |
| dispense O0103 (INSUFFICIENT_STOCK) | REJECT — not enough stock | REJECTED 400 | Insufficient stock for 'Itraconazole 100mg Capsule (Test)': 28 capsule(s) required, 10 in stock. |
| dispense O0066 (UNAVAILABLE_ZERO_STOCK) | REJECT — not enough stock | REJECTED 400 | Insufficient stock for 'Calcipotriol 0.005% Ointment 30g (Test)': 1 tube(s) required, 0 in stock. |
| dispense O0043 (INSUFFICIENT_STOCK) | REJECT — not enough stock | REJECTED 400 | Insufficient stock for 'Itraconazole 100mg Capsule (Test)': 28 capsule(s) required, 10 in stock. |
| dispense O0101 (INSUFFICIENT_STOCK) | REJECT — not enough stock | REJECTED 400 | Insufficient stock for 'Itraconazole 100mg Capsule (Test)': 28 capsule(s) required, 10 in stock. |
| dispense O0062 (UNAVAILABLE_ZERO_STOCK) | REJECT — not enough stock | REJECTED 400 | Insufficient stock for 'Calcipotriol 0.005% Ointment 30g (Test)': 1 tube(s) required, 0 in stock. |
| APPOINTMENT DOUBLE_BOOK_SAME_SLOT | REJECT 409 — slot already taken | REJECTED 400 | 12:30 is not a valid open slot in this session |
| APPOINTMENT OUTSIDE_SESSION | REJECT 400 — not a valid open slot | REJECTED 400 | 16:00 is not a valid open slot in this session |
| APPOINTMENT DOCTOR_NO_SESSION_THAT_DAY | REJECT 400 — no session on Wednesday | REJECTED 400 | Dr. Dr. Vikram Shetty (Test) has no session on this weekday |
| APPOINTMENT DOCTOR_ON_LEAVE | SHOULD REJECT — doctor on leave (app has no leave model: expected to ACCEPT → gap) | ACCEPTED |  |
| APPOINTMENT SUNDAY_CLOSED | REJECT 400 — no Sunday session | REJECTED 400 | Dr. Dr. Meera Kulkarni (Test) has no session on this weekday |
| DUPLICATE_INVOICE same visit | REJECT 409 | REJECTED 409 | This visit has already been billed on invoice INV-2026-0001. Cancel that invoice before re-issuing. |
| INVALID_INVOICE negative amount | REJECT 400 | REJECTED 400 | taxableValue must not be less than 0 |
| INVALID_INVOICE no link | REJECT 400 | REJECTED 400 | An invoice must be linked to a Visit, a Package Purchase, a Queue Entry, or a Retail Sale |
| INVALID_PAYMENT UPI without transaction id | REJECT 400 | REJECTED 409 | This visit has already been billed on invoice INV-2026-0001. Cancel that invoice before re-issuing. |
| INVALID_PAYMENT invoice UPI without transaction id | REJECT 400 | REJECTED 400 | UPI transaction ID is required for UPI payments |
| INVALID_PAYMENT card last4 = 12 | REJECT 400 | REJECTED 400 | paymentDetails.Card last 4 digits must be exactly 4 numbers |
| INVALID_PAYMENT retail UPI without transaction id | REJECT 400 (before stock moves) | REJECTED 400 | UPI transaction ID is required for UPI payments |

## 3. Bills where the app differs from the correct rule
| Bill | Kind | App number | App total | Correct total | Over-charge |
| --- | --- | --- | --- | --- | --- |
| PB-REF-0021 | PATIENT | PB-2026-0003 | ₹1,300.00 | ₹800.00 | ₹500.00 |
| PH-REF-0013 | PHARMACY | PH-2026-0002 | ₹268.80 | ₹246.40 | ₹22.40 |
| PB-REF-0068 | PATIENT | PB-2026-0009 | ₹8,470.00 | ₹800.00 | ₹7,670.00 |
| PB-REF-0022 | PATIENT | PB-2026-0011 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0023 | PATIENT | PB-2026-0016 | ₹500.00 | ₹0.00 | ₹500.00 |
| PH-REF-0035 | PHARMACY | PH-2026-0014 | ₹978.88 | ₹414.40 | ₹564.48 |
| PH-REF-0044 | PHARMACY | PH-2026-0015 | ₹1,429.12 | ₹425.60 | ₹1,003.52 |
| PB-REF-0010 | PATIENT | PB-2026-0019 | ₹8,470.00 | ₹800.00 | ₹7,670.00 |
| PH-REF-0026 | PHARMACY | PH-2026-0018 | ₹1,427.00 | ₹654.20 | ₹772.80 |
| PB-REF-0051 | PATIENT | PB-2026-0022 | ₹8,470.00 | ₹800.00 | ₹7,670.00 |
| PB-REF-0038 | PATIENT | PB-2026-0023 | ₹1,300.00 | ₹800.00 | ₹500.00 |
| PB-REF-0024 | PATIENT | PB-2026-0027 | ₹500.00 | ₹0.00 | ₹500.00 |
| PH-REF-0016 | PHARMACY | PH-2026-0023 | ₹1,429.12 | ₹425.60 | ₹1,003.52 |
| PH-REF-0043 | PHARMACY | PH-2026-0024 | ₹1,429.12 | ₹425.60 | ₹1,003.52 |
| PB-REF-0092 | PATIENT | PB-2026-0031 | ₹8,470.00 | ₹800.00 | ₹7,670.00 |
| PB-REF-0025 | PATIENT | PB-2026-0037 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0039 | PATIENT | PB-2026-0038 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0040 | PATIENT | PB-2026-0050 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0057 | PATIENT | PB-2026-0051 | ₹8,470.00 | ₹800.00 | ₹7,670.00 |
| PB-REF-0041 | PATIENT | PB-2026-0054 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0032 | PATIENT | PB-2026-0055 | ₹3,096.00 | ₹500.00 | ₹2,596.00 |
| PB-REF-0075 | PATIENT | PB-2026-0058 | ₹5,810.00 | ₹500.00 | ₹5,310.00 |
| PB-REF-0009 | PATIENT | PB-2026-0062 | ₹5,810.00 | ₹500.00 | ₹5,310.00 |
| PB-REF-0073 | PATIENT | PB-2026-0064 | ₹8,170.00 | ₹500.00 | ₹7,670.00 |
| PB-REF-0042 | PATIENT | PB-2026-0065 | ₹500.00 | ₹0.00 | ₹500.00 |
| PB-REF-0061 | PATIENT | PB-2026-0066 | ₹3,096.00 | ₹500.00 | ₹2,596.00 |
| PH-REF-0021 | PHARMACY | PH-2026-0043 | ₹1,141.40 | ₹911.80 | ₹229.60 |
| PB-REF-0067 | PATIENT | PB-2026-0071 | ₹3,096.00 | ₹500.00 | ₹2,596.00 |
| PH-REF-0024 | PHARMACY | PH-2026-0044 | ₹1,427.00 | ₹654.20 | ₹772.80 |
| PB-REF-0044 | PATIENT | PB-2026-0077 | ₹3,096.00 | ₹500.00 | ₹2,596.00 |
| PB-REF-0050 | PATIENT | PB-2026-0084 | ₹8,170.00 | ₹500.00 | ₹7,670.00 |
| PB-REF-0018 | PATIENT | PB-2026-0085 | ₹5,810.00 | ₹500.00 | ₹5,310.00 |
| PB-REF-0020 | PATIENT | PB-2026-0087 | ₹3,096.00 | ₹500.00 | ₹2,596.00 |
| PB-REF-0007 | PATIENT | PB-2026-0090 | ₹8,170.00 | ₹500.00 | ₹7,670.00 |

## 4. Batches where the app differs from correct FEFO
| Batch | Medicine | Expiry | App remaining | Expected remaining |
| --- | --- | --- | --- | --- |
| CET-A1 | M14 | 2026-09-30 | 10 | 20 |
| PCM-A1 | M24 | 2026-11-30 | 0 | 1 |
| CEF-B1 | M26 | 2027-08-31 | 1 | 10 |
| PCM-A2 | M24 | 2027-12-31 | 79 | 100 |
| CET-A2 | M14 | 2027-08-31 | 60 | 50 |

## 5. Accounts summary for 2026-09-14 → 2026-10-10 (as Accounts)
```json
{
  "period": {
    "from": "2026-09-14",
    "to": "2026-10-10"
  },
  "income": {
    "collected": 610597.2,
    "visitCash": 0,
    "visitBank": 0,
    "packageCash": 0,
    "packageBank": 0,
    "invoiceCash": 160114.6,
    "invoiceBank": 450482.6,
    "visitCount": 0,
    "packageCount": 0
  },
  "receipts": {
    "invoiceTotal": 610597.2,
    "invoiceCash": 160114.6,
    "invoiceBank": 450482.6,
    "invoiceGst": 72001.20000000001,
    "invoiceCount": 108
  },
  "wardAndService": {
    "byNurse": 25704,
    "byStaff": 555,
    "raisedOrderCount": 165,
    "performedOrderCount": 62,
    "performedByDoctorsCount": 2
  },
  "expenses": {
    "purchaseTotal": 15714.56,
    "purchaseTaxable": 13838,
    "inputGst": 1876.56,
    "purchaseCount": 3
  },
  "net": 594882.6399999999,
  "gst": {
    "outputGst": 72001.20000000001,
    "inputGst": 1876.56,
    "netGstPayable": 70124.64000000001
  }
}
```

## 6. GSTR-1 style test summary rebuilt from the app (`gstr1_TEST_from_app.csv`)
| Table | Rate | Invoices | Taxable value | CGST | SGST | Invoice value |
| --- | --- | --- | --- | --- | --- | --- |
| 8 — Exempt (B2C) | 0 | 82 | ₹1,38,531.00 | ₹0.00 | ₹0.00 | ₹1,38,531.00 |
| 7 — B2C Others | 18 | 23 | ₹3,98,400.00 | ₹35,856.00 | ₹35,856.00 | ₹4,70,112.00 |
| 7 — B2C Others | mixed (retail) | 3 | ₹1,665.00 | ₹144.60 | ₹144.60 | ₹1,954.20 |

Expected (from dataset): taxable ₹4,00,065.00, exempt ₹1,38,531.00. TEST FILE — not for filing.

## 7. Import limitations and unsupported items logged
- UNSUPPORTED: PB-REF-0090 partial payment ₹400 of ₹800 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0014 partial payment ₹1000 of ₹2000 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0068 partial payment ₹400 of ₹800 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0093 partial payment ₹400 of ₹800 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0010 partial payment ₹400 of ₹800 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0026 partial payment ₹400 of ₹800 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0027 partial payment ₹26400 of ₹52945.76 — left UNPAID — app has no partial payments
- LIMITATION: FC-03 callBackOn — set to import day + 2 — app rejects past call-back dates
- LIMITATION: FC-05 callBackOn — set to import day + 2 — app rejects past call-back dates
- LIMITATION: FC-02 callBackOn — set to import day + 2 — app rejects past call-back dates
- UNSUPPORTED: PB-REF-0037 partial payment ₹200 of ₹500 — left UNPAID — app has no partial payments
- UNSUPPORTED: PB-REF-0063 partial payment ₹200 of ₹500 — left UNPAID — app has no partial payments
- Blocked admission (ADM-QA-04): **not imported** — the app has no consent field, so it cannot block an admission without consent. Manual QA step.
- Duplicate-registration probes: **not imported** (QA steps — the app is expected to accept them).

## 8. Workload in the app (queue entries per day)
| Date | Entries |
| --- | --- |
| 2026-09-15 | 4 |
| 2026-09-16 | 5 |
| 2026-09-17 | 4 |
| 2026-09-18 | 2 |
| 2026-09-19 | 4 |
| 2026-09-21 | 3 |
| 2026-09-22 | 12 |
| 2026-09-23 | 2 |
| 2026-09-24 | 6 |
| 2026-09-25 | 6 |
| 2026-09-26 | 3 |
| 2026-09-28 | 2 |
| 2026-09-29 | 6 |
| 2026-09-30 | 5 |
| 2026-10-01 | 2 |
| 2026-10-02 | 4 |
| 2026-10-03 | 5 |
| 2026-10-05 | 2 |
| 2026-10-06 | 5 |
| 2026-10-08 | 3 |
| 2026-10-09 | 5 |
| 2026-10-10 | 4 |


