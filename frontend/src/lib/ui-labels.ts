/**
 * Dynamic UI copy: module names, headers, actions, and shared dropdown labels.
 * Evaluates based on the current language in globalLanguageState.
 */

import { getTranslation, globalLanguageState } from '@/context/LanguageContext';

export const NAV_SECTIONS = {
  get overview() { return getTranslation('nav.overview', 'Overview'); },
  get systemControl() { return getTranslation('nav.systemControl', 'System Control'); },
  get fieldOperations() { return getTranslation('nav.fieldOperations', 'Field Operations'); },
  get campaign() { return getTranslation('nav.campaign', 'Campaign'); },
  get aiTools() { return getTranslation('nav.aiTools', 'AI Tools'); },
};

/** Sidebar link text — must match module naming used on pages. */
export const SIDEBAR = {
  get dashboard() { return getTranslation('sidebar.dashboard', 'Dashboard'); },
  get users() { return getTranslation('sidebar.users', 'Users'); },
  get constituency() { return getTranslation('sidebar.constituency', 'Constituency'); },
  get teams() { return getTranslation('sidebar.teams', 'Teams'); },
  get voters() { return getTranslation('sidebar.voters', 'Voters'); },
  get tasks() { return getTranslation('sidebar.tasks', 'Tasks'); },
  get surveys() { return getTranslation('sidebar.surveys', 'Surveys'); },
  get events() { return getTranslation('sidebar.events', 'Event Management'); },
  get workAllocation() { return getTranslation('sidebar.workAllocation', 'Work Allocation'); },
  get reports() { return getTranslation('sidebar.reports', 'Reports'); },
  get messages() { return getTranslation('sidebar.messages', 'Messages'); },
  get mediaLibrary() { return getTranslation('sidebar.mediaLibrary', 'Media Library'); },
  get aiAssistant() { return getTranslation('sidebar.aiAssistant', 'AI Assistant'); },
  get partyMembers() { return getTranslation('sidebar.partyMembers', 'Party Members'); },
  get whatsapp() { return getTranslation('sidebar.whatsapp', 'WhatsApp Campaigns'); },
};


export const MODULE_HEADER = {
  get dashboard() {
    return {
      title: getTranslation('sidebar.dashboard', 'Dashboard'),
      subtitle: getTranslation('dashboard.subtitle', 'Overview and key metrics')
    };
  },
  get dashboardLoading() {
    return {
      title: getTranslation('sidebar.dashboard', 'Dashboard'),
      subtitle: getTranslation('action.loading', 'Loading data…')
    };
  },
  get users() {
    return {
      title: getTranslation('sidebar.users', 'Users'),
      subtitle: getTranslation('users.subtitle', 'Manage users, roles, and access control')
    };
  },
  get teams() {
    return {
      title: getTranslation('sidebar.teams', 'Teams'),
      subtitle: getTranslation('teams.subtitle', 'Manage field workers and team structure')
    };
  },
  get voters() {
    return {
      title: getTranslation('sidebar.voters', 'Voters'),
      subtitle: getTranslation('voters.subtitle', 'Voter database and support tracking')
    };
  },
  get tasks() {
    return {
      title: getTranslation('sidebar.tasks', 'Tasks'),
      subtitle: getTranslation('tasks.subtitle', 'Assign and track campaign tasks')
    };
  },
  get surveys() {
    return {
      title: getTranslation('sidebar.surveys', 'Surveys'),
      subtitle: getTranslation('surveys.subtitle', 'Voter sentiment tracking and analysis')
    };
  },
  get events() {
    return {
      title: getTranslation('sidebar.events', 'Event Management'),
      subtitle: getTranslation('events.subtitle', 'Organize and track campaign events')
    };
  },
  get workAllocation() {
    return {
      title: getTranslation('sidebar.workAllocation', 'Work Allocation'),
      subtitle: getTranslation('workAllocation.subtitle', 'Assign work, track status, and submit proof')
    };
  },
  get reports() {
    return {
      title: getTranslation('sidebar.reports', 'Reports'),
      subtitle: getTranslation('reports.subtitle', 'Analytics and exports')
    };
  },
  get messages() {
    return {
      title: getTranslation('sidebar.messages', 'Messages'),
      subtitle: getTranslation('messages.subtitle', 'Communication center')
    };
  },
  get whatsapp() {
    return {
      title: getTranslation('sidebar.whatsapp', 'WhatsApp Campaigns'),
      subtitle: getTranslation('whatsapp.subtitle', 'Bulk & individual WhatsApp campaign management')
    };
  },
  get media() {

    return {
      title: getTranslation('sidebar.mediaLibrary', 'Media Library'),
      subtitle: getTranslation('media.subtitle', 'Campaign media assets and documents')
    };
  },
  get constituency() {
    return {
      title: getTranslation('sidebar.constituency', 'Constituency'),
      subtitle: getTranslation('constituency.subtitle', 'Geographical hierarchy management')
    };
  },
  get aiAssistant() {
    return {
      title: getTranslation('sidebar.aiAssistant', 'AI Assistant'),
      subtitle: getTranslation('ai.welcome_subtitle', 'Intelligent chat powered by XPanda')
    };
  },
  get aiAssistantRestricted() {
    return {
      title: getTranslation('sidebar.aiAssistant', 'AI Assistant'),
      subtitle: getTranslation('ai.restricted_subtitle', 'Access restricted')
    };
  },
  get partyMembers() {
    return {
      title: getTranslation('sidebar.partyMembers', 'Party Members'),
      subtitle: getTranslation('partyMembers.subtitle', 'Party member database, demographics, and support tracking')
    };
  },
};

/** Task type options (value = API key, label = user-facing). */
export const TASK_TYPE_OPTIONS = [
  { value: 'door_to_door', get label() { return getTranslation('task.type.door_to_door', 'Door-to-door'); } },
  { value: 'survey_collection', get label() { return getTranslation('task.type.survey_collection', 'Survey collection'); } },
  { value: 'event_participation', get label() { return getTranslation('task.type.event_participation', 'Event participation'); } },
  { value: 'voter_outreach', get label() { return getTranslation('task.type.voter_outreach', 'Voter outreach'); } },
  { value: 'report_submission', get label() { return getTranslation('task.type.report_submission', 'Report submission'); } },
];

/** Event category options (value = API key). */
export const EVENT_TYPE_OPTIONS = [
  { value: 'rally', get label() { return getTranslation('event.type.rally', 'Rally'); } },
  { value: 'nukkad_sabha', get label() { return getTranslation('event.type.nukkad_sabha', 'Nukkad Sabha'); } },
  { value: 'door_to_door', get label() { return getTranslation('event.type.door_to_door', 'Door-to-door'); } },
  { value: 'public_meeting', get label() { return getTranslation('event.type.public_meeting', 'Public meeting'); } },
];

/** Event workflow status (value = API key). */
export const EVENT_STATUS_LABELS = {
  get upcoming() { return getTranslation('label.upcoming', 'Upcoming'); },
  get in_progress() { return getTranslation('label.processing', 'In progress'); },
  get completed() { return getTranslation('label.completed', 'Completed'); },
  get cancelled() { return getTranslation('label.cancelled', 'Cancelled'); },
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
  const val = (EVENT_STATUS_LABELS as any)[status];
  return val ?? status.replace(/_/g, ' ');
}

export const TASKS_UI = {
  get statsTotal() { return getTranslation('tasks.ui.statsTotal', 'Total tasks'); },
  get listHeading() { return getTranslation('tasks.ui.listHeading', 'Task list'); },
  get createButton() { return getTranslation('tasks.ui.createButton', 'Create task'); },
  get modalCreateTitle() { return getTranslation('tasks.ui.modalCreateTitle', 'Create task'); },
  get modalEditTitle() { return getTranslation('tasks.ui.modalEditTitle', 'Edit task'); },
  get modalAssigneeTitle() { return getTranslation('tasks.ui.modalAssigneeTitle', 'Update task progress'); },
  get modalFooterCreate() { return getTranslation('tasks.ui.modalFooterCreate', 'Create task'); },
  get modalFooterSave() { return getTranslation('tasks.ui.modalFooterSave', 'Save changes'); },
  get detailsTitle() { return getTranslation('tasks.ui.detailsTitle', 'Task details'); },
  get detailsSubtitle() { return getTranslation('tasks.ui.detailsSubtitle', 'Assignment, status, and history'); },
};

export const EVENTS_UI = {
  get listHeading() { return getTranslation('events.ui.listHeading', 'Events'); },
  get modalCreateTitle() { return getTranslation('events.ui.modalCreateTitle', 'Create event'); },
  get modalEditTitle() { return getTranslation('events.ui.modalEditTitle', 'Edit event'); },
  get modalSubtitle() { return getTranslation('events.ui.modalSubtitle', 'Plan and coordinate events'); },
  get modalFooterSchedule() { return getTranslation('events.ui.modalFooterSchedule', 'Create event'); },
  get modalFooterSave() { return getTranslation('events.ui.modalFooterSave', 'Save changes'); },
  get locationLabel() { return getTranslation('events.ui.locationLabel', 'Location'); },
  get statusLabel() { return getTranslation('events.ui.statusLabel', 'Status'); },
  get detailsSubtitle() { return getTranslation('events.ui.detailsSubtitle', 'Planning, attendance, and execution summary'); },
};

export const WORK_ALLOCATION_UI = {
  get statsTotal() { return getTranslation('wa.ui.statsTotal', 'Total allocations'); },
  get sectionHeading() { return getTranslation('wa.ui.sectionHeading', 'Work Allocation'); },
  get sectionSub() { return getTranslation('wa.ui.sectionSub', 'Track assignments, proof, and completion'); },
  get createButton() { return getTranslation('wa.ui.createButton', 'Create work allocation'); },
  get filterStatusAll() { return getTranslation('wa.ui.filterStatusAll', 'All statuses'); },
  get filterWorkTypeAll() { return getTranslation('wa.ui.filterWorkTypeAll', 'All work types'); },
  get searchPlaceholder() { return getTranslation('wa.ui.searchPlaceholder', 'Search work allocation…'); },
  get emptyTitle() { return getTranslation('wa.ui.emptyTitle', 'No work allocations'); },
  get assignedTeamLabel() { return getTranslation('wa.ui.assignedTeamLabel', 'Assigned team'); },
  get cardFallbackDescription() { return getTranslation('wa.ui.cardFallbackDescription', 'No additional description provided.'); },
  get executionModalTitle() { return getTranslation('wa.ui.executionModalTitle', 'Work allocation — proof & status'); },
  get executionModalSubtitle() { return getTranslation('wa.ui.executionModalSubtitle', 'Submit proof images and update status'); },
  get modalClose() { return getTranslation('wa.ui.modalClose', 'Close'); },
  get proofPreviewTitle() { return getTranslation('wa.ui.proofPreviewTitle', 'Proof preview'); },
  get proofPreviewSubtitle() { return getTranslation('wa.ui.proofPreviewSubtitle', 'Submitted image'); },
  get proofGalleryHint() { return getTranslation('wa.ui.proofGalleryHint', 'Proof gallery (tap to preview)'); },
  get formCreateTitle() { return getTranslation('wa.ui.formCreateTitle', 'Create work allocation'); },
  get formEditTitle() { return getTranslation('wa.ui.formEditTitle', 'Edit work allocation'); },
  get formSubtitle() { return getTranslation('wa.ui.formSubtitle', 'Select event, work type, assignees, and due date'); },
  get formEventLabel() { return getTranslation('wa.ui.formEventLabel', 'Event'); },
  get formWorkTypeLabel() { return getTranslation('wa.ui.formWorkTypeLabel', 'Work type'); },
  get formSelectEvent() { return getTranslation('wa.ui.formSelectEvent', 'Select event'); },
  get formSelectWorkType() { return getTranslation('wa.ui.formSelectWorkType', 'Select work type'); },
  get formDeadlineLabel() { return getTranslation('wa.ui.formDeadlineLabel', 'Due date'); },
  get formStatusLabel() { return getTranslation('wa.ui.formStatusLabel', 'Status'); },
  get formStatusPending() { return getTranslation('wa.ui.formStatusPending', 'Pending'); },
  get formStatusProcessing() { return getTranslation('wa.ui.formStatusProcessing', 'In progress'); },
  get formStatusCompleted() { return getTranslation('wa.ui.formStatusCompleted', 'Completed'); },
  get formStatusCancelled() { return getTranslation('wa.ui.formStatusCancelled', 'Cancelled'); },
  get formStatusNotCompleted() { return getTranslation('wa.ui.formStatusNotCompleted', 'Not completed'); },
  get formAssignLabel() { return getTranslation('wa.ui.formAssignLabel', 'Assign users'); },
  get formDescriptionLabel() { return getTranslation('wa.ui.formDescriptionLabel', 'Description'); },
  get formDescriptionPlaceholder() { return getTranslation('wa.ui.formDescriptionPlaceholder', 'Describe the work to be done, location notes, and expectations.'); },
  get formFooterCreate() { return getTranslation('wa.ui.formFooterCreate', 'Create allocation'); },
  get formFooterSave() { return getTranslation('wa.ui.formFooterSave', 'Save changes'); },
  get formFooterCancel() { return getTranslation('wa.ui.formFooterCancel', 'Cancel'); },
  get detailsTitle() { return getTranslation('wa.ui.detailsTitle', 'Work allocation details'); },
  get detailsSubtitle() { return getTranslation('wa.ui.detailsSubtitle', 'Assignment, proof, and status'); },
  get statusActionsLabel() { return getTranslation('wa.ui.statusActionsLabel', 'Status actions'); },
  get actionStart() { return getTranslation('wa.ui.actionStart', 'Start work'); },
  get actionStartSub() { return getTranslation('wa.ui.actionStartSub', 'Set status to in progress'); },
  get actionComplete() { return getTranslation('wa.ui.actionComplete', 'Mark completed'); },
  get actionCompleteSub() { return getTranslation('wa.ui.actionCompleteSub', 'After required proof is submitted'); },
  get actionNotCompleted() { return getTranslation('wa.ui.actionNotCompleted', 'Mark not completed'); },
  get timelineHeading() { return getTranslation('wa.ui.timelineHeading', 'Timeline'); },
  get timelineStarted() { return getTranslation('wa.ui.timelineStarted', 'Started'); },
  get timelineCompleted() { return getTranslation('wa.ui.timelineCompleted', 'Completed'); },
  get timelineTba() { return getTranslation('wa.ui.timelineTba', '—'); },
  get cameraDenied() { return getTranslation('wa.ui.cameraDenied', 'Camera access denied. Use HTTPS and allow camera permissions.'); },
  get generalProofCamera() { return getTranslation('wa.ui.generalProofCamera', 'General proof (camera)'); },
  get batchUploadLabel() { return getTranslation('wa.ui.batchUploadLabel', 'Batch image upload'); },
  get batchSelectImages() { return getTranslation('wa.ui.batchSelectImages', 'Select images'); },
};

export const CONSTITUENCY_UI = {
  get subtitleDetail() { return getTranslation('const.ui.subtitleDetail', 'State → District → Constituency → Area → Ward → Booth'); },
  get sectionHeading() { return getTranslation('const.ui.sectionHeading', 'Hierarchy management'); },
};

export const TEAMS_UI = {
  get listHeading() { return getTranslation('teams.ui.listHeading', 'Teams'); },
  get addMember() { return getTranslation('teams.ui.addMember', 'Add member'); },
};

export const WARD_DASHBOARD_UI = {
  get title() { return getTranslation('ward.ui.title', 'Ward overview'); },
  get sortedByCoverage() { return getTranslation('ward.ui.sortedByCoverage', 'Sorted by coverage'); },
};

export function wardDashboardSubtitle(boothCount: number): string {
  const lang = globalLanguageState.current || 'en';
  if (lang === 'hi') {
    return `${boothCount} बूथों पर प्रगति की निगरानी की जा रही है।`;
  }
  return `Tracking coverage across ${boothCount} booths.`;
}

export const MEDIA_UI = {
  get modalSubtitle() { return getTranslation('media.ui.modalSubtitle', 'Upload and tag media assets'); },
  get addToLibrary() { return getTranslation('media.ui.addToLibrary', 'Add to library'); },
  get typePdf() { return getTranslation('media.ui.typePdf', 'Document / PDF'); },
};

export const SHARED_UI = {
  get notificationsHeading() { return getTranslation('shared.ui.notificationsHeading', 'Notifications'); },
  get cameraOpen() { return getTranslation('shared.ui.cameraOpen', 'Open camera'); },
  get surveyObservations() { return getTranslation('shared.ui.surveyObservations', 'Observations'); },
  get voterRemarks() { return getTranslation('shared.ui.voterRemarks', 'Remarks & notes'); },
  get teamsDesignation() { return getTranslation('shared.ui.teamsDesignation', 'Designation'); },
  get mediaAddTitle() { return getTranslation('shared.ui.mediaAddTitle', 'Add media'); },
  get mediaTypeImage() { return getTranslation('shared.ui.mediaTypeImage', 'Image'); },
  get mediaTypeVideo() { return getTranslation('shared.ui.mediaTypeVideo', 'Video'); },
  get wardProgressTitle() { return getTranslation('shared.ui.wardProgressTitle', 'Booth-wise progress'); },
};
