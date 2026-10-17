export const helpContent = {
  parent: [
    {
      question: 'How do I book a trip?',
      answer: 'Complete your child, school, and pickup details in Settings, then use the booking controls on your Dashboard to choose a date and time and submit a request.',
    },
    {
      question: 'Can I book several children together?',
      answer: 'You can include several children from the same school in one booking. Children attending different schools need separate bookings.',
    },
    {
      question: 'How do I change the pickup pin?',
      answer: 'Open Settings, edit your pickup location, and use the map picker to place the pin at the correct spot before saving.',
    },
    {
      question: 'What do trip statuses mean?',
      answer: 'Searching means the system is looking for an available driver. Accepted means a driver accepted the trip. Arrived means the driver has arrived at pickup. Picked up means the student is on board. At school means the trip has reached the school. Completed means the school run has been marked complete.',
    },
    {
      question: 'Why do I see “No driver is assigned to this school yet”?',
      answer: 'A driver has not yet been assigned to that school in the system. Contact the app administrator so they can review the school assignment.',
    },
    {
      question: 'How do I cancel a trip?',
      answer: 'Open your active trip and use its cancel action if cancellation is available. A trip may no longer be cancellable after the student has been picked up.',
    },
    {
      question: 'How can I track the van?',
      answer: 'Open the active trip on your Dashboard to view the driver’s shared live location when it is available. Location updates depend on the driver’s device and GPS connection.',
    },
    {
      question: 'Can I message the driver?',
      answer: 'Chat is private between you and your driver, and its history is saved. You can send messages only while the trip is active; you can still read the conversation afterwards.',
    },
    {
      question: 'How do I read or delete notifications?',
      answer: 'Open Notifications to review updates. Use the delete action on an individual notification to remove just that item, or choose Clear all to remove all notifications.',
    },
    {
      question: 'How do payments work?',
      answer: 'In-app payment features are coming soon. For now, pay the driver directly and agree on payment details with them.',
    },
    {
      question: 'What do the driver profile, photo, and “Verified by admin” badge mean?',
      answer: 'The profile shows driver details shared for your trip, and the photo helps you recognize the driver. “Verified by admin” means an administrator reviewed the driver’s submitted information. Your view never shows the full license; it shows only the license expiry month and year.',
    },
    {
      question: 'How is my data handled?',
      answer: 'Account and trip details are used to provide the transportation service and are available to the people who need them to manage or complete your trip. Chat messages are saved. Do not include sensitive information that is not needed for the trip.',
    },
  ],
  driver: [
    {
      question: 'How do I go online or offline?',
      answer: 'Use the availability control in Trip Requests to switch your status. You must be online to receive eligible requests; switch offline when you are not available.',
    },
    {
      question: 'How do I accept a request?',
      answer: 'Open Trip Requests, review the trip details, and choose Accept on a request you can serve.',
    },
    {
      question: 'Why can’t I see any requests?',
      answer: 'Your account must be approved by an administrator, assigned to the relevant school, online, and linked to an available vehicle with enough seats. Also check that there are eligible requests for your assigned area and schedule.',
    },
    {
      question: 'What do the GPS controls and Active/Inactive status mean?',
      answer: 'Use Start GPS to share location updates for an active trip and Stop GPS when tracking should end. Active means location tracking is running; Inactive means it is not.',
    },
    {
      question: 'What are the trip steps?',
      answer: 'Use Arrived at Pickup when you reach the pickup point, Picked Up after the student boards, Arrived at School when you reach the school, and Complete School Run when the run is finished.',
    },
    {
      question: 'What should I do if GPS fails?',
      answer: 'Check that device location services and browser location permission are enabled, then retry GPS. If updates still fail, let the parent or administrator know and report the trip date and what happened.',
    },
    {
      question: 'What are Passengers and On board count?',
      answer: 'Passengers lists the students associated with the trip. On board count reflects the number marked as picked up; update the trip step when each student boards so the displayed count stays accurate.',
    },
    {
      question: 'How do I update my profile or vehicle details?',
      answer: 'Open Settings to edit the profile and vehicle information available to you, then save your changes. If a field cannot be changed there, ask an administrator for help.',
    },
    {
      question: 'Can I message a parent?',
      answer: 'Chat is private between you and the parent, and its history is saved. You can send messages only while the trip is active; you can still read the conversation afterwards.',
    },
    {
      question: 'How do I change my profile photo?',
      answer: 'Your profile photo is set by the administrator. Contact an administrator if your photo needs to be added or changed.',
    },
  ],
  admin: [
    {
      question: 'How do I approve a driver?',
      answer: 'Open Applications, review the driver’s submitted details and documents, then update the application status after completing your review.',
    },
    {
      question: 'How are drivers assigned to schools?',
      answer: 'School assignment is currently performed by a developer-run script. Contact the developer to run the assignment; there is no assignment action on this dashboard.',
    },
    {
      question: 'How do I set a driver photo?',
      answer: 'Driver photos are currently set using a developer-run script. Contact the developer to add or change a photo.',
    },
    {
      question: 'Where can I find the schools list?',
      answer: 'The current admin dashboard does not include a Schools list. Contact the developer to review or update the school catalog.',
    },
    {
      question: 'How should I handle reports?',
      answer: 'Open Issues to review submitted reports, then update each report’s status as it is investigated and resolved.',
    },
    {
      question: 'What do account states mean?',
      answer: 'Active accounts can use the service according to their role and approval status. Suspended accounts are temporarily restricted. Banned accounts are blocked from access. Review the account before changing its state.',
    },
  ],
}
