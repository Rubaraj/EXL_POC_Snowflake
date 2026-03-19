'use strict';

/**
 * Static lookup data for ThinkAgent collections.
 * Each export returns an array of documents ready for MongoDB insertion.
 */

function getUserTypes() {
  return [
    { UserTypeID: 1, UserType: 'General' },
    { UserTypeID: 2, UserType: 'Internal Telesales' },
    { UserTypeID: 3, UserType: 'Strategic' },
    { UserTypeID: 4, UserType: 'Telesales' },
    { UserTypeID: 5, UserType: 'HealthSpire Net' },
    { UserTypeID: 6, UserType: 'HealthSpire Tele' },
    { UserTypeID: 7, UserType: 'HealthSpire Conv' },
    { UserTypeID: 8, UserType: 'CSR Telesales' },
    { UserTypeID: 9, UserType: 'Tele Enroller' },
    { UserTypeID: 10, UserType: 'LH Agents' },
    { UserTypeID: 11, UserType: 'Partner Intake' },
    { UserTypeID: 12, UserType: 'MMS User' },
    { UserTypeID: 13, UserType: 'Ignitist_HSConv' },
    { UserTypeID: 14, UserType: 'Alight_HSConv' },
    { UserTypeID: 15, UserType: 'Int_Field' },
    { UserTypeID: 16, UserType: 'Alight_Tele' },
    { UserTypeID: 17, UserType: 'Tranzact' },
    { UserTypeID: 18, UserType: 'Reward Points' },
    { UserTypeID: 19, UserType: 'SEP' },
    { UserTypeID: 21, UserType: 'Salesforce SSO' },
    { UserTypeID: 22, UserType: 'Int_Field_Hybrid' },
    { UserTypeID: 23, UserType: 'HPOneAIT_Tele' },
    { UserTypeID: 24, UserType: 'Bloom_Tele' },
    { UserTypeID: 25, UserType: 'HPOne_ExtDTC' },
    { UserTypeID: 26, UserType: 'Tranzact_ExtDTC' },
    { UserTypeID: 27, UserType: 'HPOne_BPOTele' },
  ];
}

function getLeadStatusLookup() {
  return [
    { LeadStatusId: 1, LeadStatusName: 'New', LeadStatusDescription: 'New lead created', IsActive: true, SortOrder: 1 },
    { LeadStatusId: 2, LeadStatusName: 'Call Back', LeadStatusDescription: 'Scheduled callback', IsActive: true, SortOrder: 2 },
    { LeadStatusId: 3, LeadStatusName: 'SOA Created', LeadStatusDescription: 'SOA sent to beneficiary', IsActive: true, SortOrder: 3 },
    { LeadStatusId: 4, LeadStatusName: 'SOA Approved', LeadStatusDescription: 'SOA signed by beneficiary', IsActive: true, SortOrder: 4 },
    { LeadStatusId: 5, LeadStatusName: 'Not Interested', LeadStatusDescription: 'Lead declined', IsActive: true, SortOrder: 5 },
    { LeadStatusId: 6, LeadStatusName: 'eKit Sent', LeadStatusDescription: 'Electronic kit sent', IsActive: true, SortOrder: 6 },
    { LeadStatusId: 7, LeadStatusName: 'App Submitted', LeadStatusDescription: 'Application submitted', IsActive: true, SortOrder: 7 },
    { LeadStatusId: 8, LeadStatusName: 'App Sent for Sig', LeadStatusDescription: 'Awaiting signature', IsActive: true, SortOrder: 8 },
    { LeadStatusId: 9, LeadStatusName: 'Duplicate', LeadStatusDescription: 'Duplicate lead', IsActive: true, SortOrder: 9 },
    { LeadStatusId: 10, LeadStatusName: 'Do Not Contact', LeadStatusDescription: 'Opted out', IsActive: true, SortOrder: 10 },
    { LeadStatusId: 11, LeadStatusName: 'App Saved', LeadStatusDescription: 'Application saved as draft', IsActive: true, SortOrder: 11 },
  ];
}

function getRetailers() {
  return [
    { Retailer_Id: 1, Retailer_Name: 'CVS', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 2, Retailer_Name: 'Walgreens', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 3, Retailer_Name: 'Walmart', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 4, Retailer_Name: 'Rite Aid', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 5, Retailer_Name: 'Kroger', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 6, Retailer_Name: 'Publix', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 7, Retailer_Name: 'HEB', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 8, Retailer_Name: 'Meijer', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 9, Retailer_Name: 'Safeway', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 10, Retailer_Name: 'Albertsons', Retailer_Type: 'DETAIL', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 11, Retailer_Name: "Sam's Club", Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 12, Retailer_Name: 'Costco', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 13, Retailer_Name: 'Target', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 14, Retailer_Name: 'Wegmans', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 15, Retailer_Name: 'Giant Eagle', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 16, Retailer_Name: 'ShopRite', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 17, Retailer_Name: 'Winn-Dixie', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 18, Retailer_Name: 'Hy-Vee', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 19, Retailer_Name: 'Fred Meyer', Retailer_Type: 'SUMMARY', Event_Category: 'Retail', Is_Active: true },
    { Retailer_Id: 20, Retailer_Name: 'Jewel-Osco', Retailer_Type: 'SUMMARY', Event_Category: 'Seminar', Is_Active: true },
    { Retailer_Id: 21, Retailer_Name: 'Duane Reade', Retailer_Type: 'SUMMARY', Event_Category: 'Seminar', Is_Active: true },
  ];
}

function getSEPMaster() {
  return [
    { SEP_Id: 1, SEP_code: 'AEP', Election_type: 'A', SEP_label: 'Annual Enrollment Period', Is_date_required: false, Date_label: '', Category_id: 1, SubCategory_id: 0, Sort_order: 1, Is_active: true },
    { SEP_Id: 2, SEP_code: 'NEW', Election_type: 'E', SEP_label: 'New to Medicare', Is_date_required: true, Date_label: 'Medicare Part B Effective Date', Category_id: 2, SubCategory_id: 1, Sort_order: 2, Is_active: true },
    { SEP_Id: 3, SEP_code: 'ICE', Election_type: 'I', SEP_label: 'Already has Part A, recently got Part B', Is_date_required: true, Date_label: 'Part B Effective Date', Category_id: 2, SubCategory_id: 2, Sort_order: 3, Is_active: true },
    { SEP_Id: 4, SEP_code: 'OEP', Election_type: 'M', SEP_label: 'Open Enrollment Period - MA plan wanting change', Is_date_required: false, Date_label: '', Category_id: 1, SubCategory_id: 0, Sort_order: 4, Is_active: true },
    { SEP_Id: 5, SEP_code: 'MOV', Election_type: 'V', SEP_label: 'Moved to new address outside plan service area', Is_date_required: true, Date_label: 'Date of Move', Category_id: 3, SubCategory_id: 1, Sort_order: 5, Is_active: true },
    { SEP_Id: 6, SEP_code: 'MCD', Election_type: 'U', SEP_label: 'Change in Medicaid status', Is_date_required: true, Date_label: 'Date of Change', Category_id: 3, SubCategory_id: 2, Sort_order: 6, Is_active: true },
    { SEP_Id: 7, SEP_code: 'DEP', Election_type: 'Q', SEP_label: 'Dual-eligible/Extra Help quarterly enrollment', Is_date_required: false, Date_label: '', Category_id: 4, SubCategory_id: 1, Sort_order: 7, Is_active: true },
    { SEP_Id: 8, SEP_code: 'LEC', Election_type: 'W', SEP_label: 'Left employer coverage', Is_date_required: true, Date_label: 'Date coverage ended', Category_id: 3, SubCategory_id: 3, Sort_order: 8, Is_active: true },
    { SEP_Id: 9, SEP_code: 'MRD', Election_type: 'F', SEP_label: 'Had Medicare prior, now turning 65', Is_date_required: true, Date_label: '65th Birthday Date', Category_id: 2, SubCategory_id: 3, Sort_order: 9, Is_active: true },
    { SEP_Id: 10, SEP_code: 'IEP', Election_type: 'S', SEP_label: 'Initial Enrollment Period, had Medicare before turning 65', Is_date_required: true, Date_label: 'Part A Effective Date', Category_id: 2, SubCategory_id: 4, Sort_order: 10, Is_active: true },
    { SEP_Id: 11, SEP_code: 'LT2', Election_type: 'T', SEP_label: 'Long-term care facility - 2 months', Is_date_required: true, Date_label: 'Facility Admission Date', Category_id: 5, SubCategory_id: 1, Sort_order: 11, Is_active: true },
    { SEP_Id: 12, SEP_code: 'LTC', Election_type: 'T', SEP_label: 'Long-term care facility - continuous', Is_date_required: true, Date_label: 'Facility Admission Date', Category_id: 5, SubCategory_id: 2, Sort_order: 12, Is_active: true },
    { SEP_Id: 13, SEP_code: 'RET', Election_type: 'S', SEP_label: 'Retirement from employer group health plan', Is_date_required: true, Date_label: 'Retirement Date', Category_id: 3, SubCategory_id: 4, Sort_order: 13, Is_active: true },
    { SEP_Id: 14, SEP_code: 'PRE', Election_type: 'S', SEP_label: 'Premium assistance change or subsidy eligibility', Is_date_required: true, Date_label: 'Date of Change', Category_id: 4, SubCategory_id: 2, Sort_order: 14, Is_active: true },
    { SEP_Id: 15, SEP_code: 'RUS', Election_type: 'S', SEP_label: 'Returned to US after living abroad', Is_date_required: true, Date_label: 'Date of Return', Category_id: 3, SubCategory_id: 5, Sort_order: 15, Is_active: true },
    { SEP_Id: 16, SEP_code: 'INC', Election_type: 'S', SEP_label: 'Incarceration release - regaining Medicare eligibility', Is_date_required: true, Date_label: 'Release Date', Category_id: 3, SubCategory_id: 6, Sort_order: 16, Is_active: true },
    { SEP_Id: 17, SEP_code: 'LAW', Election_type: 'S', SEP_label: 'Lawfully present in the US - new Medicare eligibility', Is_date_required: true, Date_label: 'Eligibility Date', Category_id: 3, SubCategory_id: 7, Sort_order: 17, Is_active: true },
    { SEP_Id: 18, SEP_code: 'IND', Election_type: 'S', SEP_label: 'Individual market coverage loss', Is_date_required: true, Date_label: 'Date Coverage Ended', Category_id: 3, SubCategory_id: 8, Sort_order: 18, Is_active: true },
    { SEP_Id: 19, SEP_code: 'DST', Election_type: 'Q', SEP_label: 'FEMA-declared disaster area affected beneficiary', Is_date_required: true, Date_label: 'Disaster Declaration Date', Category_id: 6, SubCategory_id: 1, Sort_order: 19, Is_active: true },
    { SEP_Id: 20, SEP_code: 'LCC', Election_type: 'S', SEP_label: 'Loss of creditable coverage', Is_date_required: true, Date_label: 'Date Coverage Ended', Category_id: 3, SubCategory_id: 9, Sort_order: 20, Is_active: true },
    { SEP_Id: 21, SEP_code: 'MYT', Election_type: 'T', SEP_label: 'Medicare/Medicaid year-round transfer', Is_date_required: false, Date_label: '', Category_id: 4, SubCategory_id: 3, Sort_order: 21, Is_active: true },
    { SEP_Id: 22, SEP_code: 'PAC', Election_type: 'S', SEP_label: 'PACE program enrollment or disenrollment', Is_date_required: true, Date_label: 'Enrollment/Disenrollment Date', Category_id: 5, SubCategory_id: 3, Sort_order: 22, Is_active: true },
    { SEP_Id: 23, SEP_code: 'SNP', Election_type: 'S', SEP_label: 'Special Needs Plan qualification change', Is_date_required: true, Date_label: 'Date of Qualification', Category_id: 4, SubCategory_id: 4, Sort_order: 23, Is_active: true },
    { SEP_Id: 24, SEP_code: 'EOC', Election_type: 'S', SEP_label: 'Contract or plan non-renewal / service area reduction', Is_date_required: false, Date_label: '', Category_id: 6, SubCategory_id: 2, Sort_order: 24, Is_active: true },
    { SEP_Id: 25, SEP_code: 'CSN', Election_type: 'S', SEP_label: 'Chronic condition Special Needs Plan eligibility', Is_date_required: true, Date_label: 'Date of Diagnosis', Category_id: 4, SubCategory_id: 5, Sort_order: 25, Is_active: true },
    { SEP_Id: 26, SEP_code: 'NLS', Election_type: 'Q', SEP_label: 'Newly eligible for low-income subsidy', Is_date_required: true, Date_label: 'Eligibility Date', Category_id: 4, SubCategory_id: 6, Sort_order: 26, Is_active: true },
    { SEP_Id: 27, SEP_code: 'DIF', Election_type: 'S', SEP_label: 'Disenrollment from MA plan due to information error', Is_date_required: true, Date_label: 'Date of Discovery', Category_id: 6, SubCategory_id: 3, Sort_order: 27, Is_active: true },
    { SEP_Id: 28, SEP_code: 'PAP', Election_type: 'S', SEP_label: 'Plan administrative problem affecting enrollment', Is_date_required: true, Date_label: 'Date of Issue', Category_id: 6, SubCategory_id: 4, Sort_order: 28, Is_active: true },
    { SEP_Id: 29, SEP_code: 'FIV', Election_type: 'S', SEP_label: 'CMS 5-star rated plan special enrollment', Is_date_required: false, Date_label: '', Category_id: 1, SubCategory_id: 1, Sort_order: 29, Is_active: true },
    { SEP_Id: 30, SEP_code: 'TRI', Election_type: 'S', SEP_label: 'TRICARE/VA coverage change affecting Medicare eligibility', Is_date_required: true, Date_label: 'Date of Coverage Change', Category_id: 3, SubCategory_id: 10, Sort_order: 30, Is_active: true },
  ];
}

module.exports = {
  getUserTypes,
  getLeadStatusLookup,
  getRetailers,
  getSEPMaster,
};
