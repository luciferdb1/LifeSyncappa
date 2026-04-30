import { BloodGroup, Donor } from './types';

// Paste your Google Apps Script Web App URL here
// Example: "https://script.google.com/macros/s/AKfycbx.../exec"
export const GOOGLE_SCRIPT_URL = ""; 

// Helper to generate dates relative to today for the demo
const getDateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

// Simulating Google Sheet Data (Fallback if no URL provided)
export const INITIAL_DONORS: Donor[] = [
  {
    id: '1',
    name: 'Abdur Rahman',
    phone: '01711000000',
    bloodGroup: BloodGroup.B_POS,
    lastDonationDate: getDateDaysAgo(150), // 5 months ago (ELIGIBLE)
    totalDonations: 5,
    location: 'Dhaka',
    isAvailable: true,
  },
  {
    id: '2',
    name: 'Karim Uddin',
    phone: '01811000000',
    bloodGroup: BloodGroup.O_POS,
    lastDonationDate: getDateDaysAgo(30), // 1 month ago (NOT ELIGIBLE)
    totalDonations: 2,
    location: 'Chittagong',
    isAvailable: true,
  },
  {
    id: '3',
    name: 'Rahima Khatun',
    phone: '01911000000',
    bloodGroup: BloodGroup.A_POS,
    lastDonationDate: getDateDaysAgo(130), // Just eligible
    totalDonations: 8,
    location: 'Sylhet',
    isAvailable: true,
  },
  {
    id: '4',
    name: 'Suman Ahmed',
    phone: '01611000000',
    bloodGroup: BloodGroup.B_POS,
    lastDonationDate: getDateDaysAgo(10), // Very recent (NOT ELIGIBLE)
    totalDonations: 12,
    location: 'Dhaka',
    isAvailable: false,
  },
  {
    id: '5',
    name: 'Tanvir Hasan',
    phone: '01511000000',
    bloodGroup: BloodGroup.AB_POS,
    lastDonationDate: getDateDaysAgo(365), // 1 year ago (ELIGIBLE)
    totalDonations: 1,
    location: 'Comilla',
    isAvailable: true,
  },
];

export const BLOOD_GROUPS_LIST = Object.values(BloodGroup);

export const MAIN_ADMIN_EMAIL = 'debashisbarmandb1@gmail.com';