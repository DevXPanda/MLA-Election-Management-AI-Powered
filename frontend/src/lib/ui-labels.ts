/**
 * Central UI copy: module names, headers, actions, and shared dropdown labels.
 * Use these instead of duplicating strings across pages and the sidebar.
 */

export const NAV_SECTIONS = {
  overview: 'Overview',
  systemControl: 'System Control',
  fieldOperations: 'Field Operations',
  campaign: 'Campaign',
  aiTools: 'AI Tools',
} as const;

/** Sidebar link text — must match module naming used on pages. */
export const SIDEBAR = {
  dashboard: 'Dashboard',
  users: 'Users',
  constituency: 'Constituency',
  teams: 'Teams',
  voters: 'Voters',
  tasks: 'Tasks',
  surveys: 'Surveys',
  events: 'Event Management',
  workAllocation: 'Work Allocation',
  reports: 'Reports',
  messages: 'Messages',
  mediaLibrary: 'Media Library',
  aiAssistant: 'AI Assistant',
} as const;

export const MODULE_HEADER = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview and key metrics' },
  dashboardLoading: { title: 'Dashboard', subtitle: 'Loading data…' },
  users: { title: 'Users', subtitle: 'Manage users, roles, and access control' },
  teams: { title: 'Teams', subtitle: 'Manage field workers and team structure' },
  voters: { title: 'Voters', subtitle: 'Voter database and support tracking' },
  tasks: { title: 'Tasks', subtitle: 'Assign and track campaign tasks' },
  surveys: { title: 'Surveys', subtitle: 'Voter sentiment tracking and analysis' },
  events: { title: 'Event Management', subtitle: 'Organize and track campaign events' },
  workAllocation: { title: 'Work Allocation', subtitle: 'Assign work, track status, and submit proof' },
  reports: { title: 'Reports', subtitle: 'Analytics and exports' },
  messages: { title: 'Messages', subtitle: 'Communication center' },
  media: { title: 'Media Library', subtitle: 'Campaign media assets and documents' },
  constituency: { title: 'Constituency', subtitle: 'Geographical hierarchy management' },
  aiAssistant: { title: 'AI Assistant', subtitle: 'Intelligent chat powered by XPanda' },
  aiAssistantRestricted: { title: 'AI Assistant', subtitle: 'Access restricted' },
} as const;

/** Task type options (value = API key, label = user-facing). */
export const TASK_TYPE_OPTIONS = [
  { value: 'door_to_door', label: 'Door-to-door' },
  { value: 'survey_collection', label: 'Survey collection' },
  { value: 'event_participation', label: 'Event participation' },
  { value: 'voter_outreach', label: 'Voter outreach' },
  { value: 'report_submission', label: 'Report submission' },
] as const;

/** Event category options (value = API key). */
export const EVENT_TYPE_OPTIONS = [
  { value: 'rally', label: 'Rally' },
  { value: 'nukkad_sabha', label: 'Nukkad Sabha' },
  { value: 'door_to_door', label: 'Door-to-door' },
  { value: 'public_meeting', label: 'Public meeting' },
] as const;

/** Event workflow status (value = API key). */
export const EVENT_STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function taskTypeLabel(type: string): string {
  const row = TASK_TYPE_OPTIONS.find((o) => o.value === type);
  return row?.label ?? type.replace(/_/g, ' ');
}

export function eventTypeLabel(type: string): string {
  const row = EVENT_TYPE_OPTIONS.find((o) => o.value === type);
  return row?.label ?? type.replace(/_/g, ' ');
}

export function eventStatusLabel(status: string): string {
  return EVENT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export const TASKS_UI = {
  statsTotal: 'Total tasks',
  listHeading: 'Task list',
  createButton: 'Create task',
  modalCreateTitle: 'Create task',
  modalEditTitle: 'Edit task',
  modalAssigneeTitle: 'Update task progress',
  modalFooterCreate: 'Create task',
  modalFooterSave: 'Save changes',
  detailsTitle: 'Task details',
  detailsSubtitle: 'Assignment, status, and history',
} as const;

export const EVENTS_UI = {
  listHeading: 'Events',
  modalCreateTitle: 'Create event',
  modalEditTitle: 'Edit event',
  modalSubtitle: 'Plan and coordinate events',
  modalFooterSchedule: 'Create event',
  modalFooterSave: 'Save changes',
  locationLabel: 'Location',
  statusLabel: 'Status',
  detailsSubtitle: 'Planning, attendance, and execution summary',
} as const;

export const WORK_ALLOCATION_UI = {
  statsTotal: 'Total allocations',
  sectionHeading: 'Work Allocation',
  sectionSub: 'Track assignments, proof, and completion',
  createButton: 'Create work allocation',
  filterStatusAll: 'All statuses',
  filterWorkTypeAll: 'All work types',
  searchPlaceholder: 'Search work allocation…',
  emptyTitle: 'No work allocations',
  assignedTeamLabel: 'Assigned team',
  cardFallbackDescription: 'No additional description provided.',
  executionModalTitle: 'Work allocation — proof & status',
  executionModalSubtitle: 'Submit proof images and update status',
  modalClose: 'Close',
  proofPreviewTitle: 'Proof preview',
  proofPreviewSubtitle: 'Submitted image',
  proofGalleryHint: 'Proof gallery (tap to preview)',
  formCreateTitle: 'Create work allocation',
  formEditTitle: 'Edit work allocation',
  formSubtitle: 'Select event, work type, assignees, and due date',
  formEventLabel: 'Event',
  formWorkTypeLabel: 'Work type',
  formSelectEvent: 'Select event',
  formSelectWorkType: 'Select work type',
  formDeadlineLabel: 'Due date',
  formStatusLabel: 'Status',
  formStatusPending: 'Pending',
  formStatusProcessing: 'In progress',
  formStatusCompleted: 'Completed',
  formStatusCancelled: 'Cancelled',
  formStatusNotCompleted: 'Not completed',
  formAssignLabel: 'Assign users',
  formDescriptionLabel: 'Description',
  formDescriptionPlaceholder: 'Describe the work to be done, location notes, and expectations.',
  formFooterCreate: 'Create allocation',
  formFooterSave: 'Save changes',
  formFooterCancel: 'Cancel',
  detailsTitle: 'Work allocation details',
  detailsSubtitle: 'Assignment, proof, and status',
  statusActionsLabel: 'Status actions',
  actionStart: 'Start work',
  actionStartSub: 'Set status to in progress',
  actionComplete: 'Mark completed',
  actionCompleteSub: 'After required proof is submitted',
  actionNotCompleted: 'Mark not completed',
  timelineHeading: 'Timeline',
  timelineStarted: 'Started',
  timelineCompleted: 'Completed',
  timelineTba: '—',
  cameraDenied: 'Camera access denied. Use HTTPS and allow camera permissions.',
  generalProofCamera: 'General proof (camera)',
  batchUploadLabel: 'Batch image upload',
  batchSelectImages: 'Select images',
} as const;

export const CONSTITUENCY_UI = {
  subtitleDetail: 'State → District → Constituency → Area → Ward → Booth',
  sectionHeading: 'Hierarchy management',
} as const;

export const TEAMS_UI = {
  listHeading: 'Teams',
  addMember: 'Add member',
} as const;

export const WARD_DASHBOARD_UI = {
  title: 'Ward overview',
  sortedByCoverage: 'Sorted by coverage',
} as const;

export function wardDashboardSubtitle(boothCount: number): string {
  return `Tracking coverage across ${boothCount} booths.`;
}

export const MEDIA_UI = {
  modalSubtitle: 'Upload and tag media assets',
  addToLibrary: 'Add to library',
  typePdf: 'Document / PDF',
} as const;

export const SHARED_UI = {
  notificationsHeading: 'Notifications',
  cameraOpen: 'Open camera',
  surveyObservations: 'Observations',
  voterRemarks: 'Remarks & notes',
  teamsDesignation: 'Designation',
  mediaAddTitle: 'Add media',
  mediaTypeImage: 'Image',
  mediaTypeVideo: 'Video',
  wardProgressTitle: 'Booth-wise progress',
} as const;
