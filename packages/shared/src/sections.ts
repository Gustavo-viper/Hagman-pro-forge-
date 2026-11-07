/**
 * Maps every universe feature key (universe_settings.features) to the engine that powers it.
 * New universes reuse these engines: adding a feature key here is enough to light it up.
 */
export type SectionEngine = 'identity' | 'quizzes' | 'ranking' | 'archive' | 'forum' | 'missions' | 'events' | 'house_cup';

export const FEATURE_ENGINE: Record<string, SectionEngine> = {
  // identity systems
  house_sorting: 'identity', hunter_identity: 'identity', faction_identity: 'identity',
  specialty_identity: 'identity', station_role: 'identity', fandom_role: 'identity',
  // games
  quizzes: 'quizzes', rankings: 'ranking', hunter_ranking: 'ranking', house_cup: 'house_cup',
  // knowledge archive
  library: 'archive', creatures: 'archive', spells: 'archive', bestiary: 'archive', creature_archive: 'archive',
  character_archive: 'archive', timelines: 'archive', multiverse_guide: 'archive', galaxy_atlas: 'archive',
  starship_archive: 'archive', species_archive: 'archive', episode_guide: 'archive', medical_cases: 'archive',
  discography: 'archive',
  // community forum
  discussions: 'forum', theories: 'forum', discussion_groups: 'forum', common_rooms: 'forum',
  fan_projects: 'forum', translations: 'forum', fan_art: 'forum', investigations: 'forum',
  // missions & challenges
  missions: 'missions', challenges: 'missions', rescue_missions: 'missions',
  // events
  events: 'events',
};

export const ARCHIVE_SECTIONS = Object.keys(FEATURE_ENGINE).filter((k) => FEATURE_ENGINE[k] === 'archive');
export const FORUM_CATEGORIES = Object.keys(FEATURE_ENGINE).filter((k) => FEATURE_ENGINE[k] === 'forum');
export const MISSION_SECTIONS = Object.keys(FEATURE_ENGINE).filter((k) => FEATURE_ENGINE[k] === 'missions');

/** Forum categories restricted to members sharing the same identity (e.g. a house). */
export const IDENTITY_SCOPED_CATEGORIES = ['common_rooms'];

export const MISSION_OBJECTIVES = ['quiz_complete', 'quiz_perfect', 'forum_topic', 'forum_reply', 'identity_set', 'event_join'] as const;
export type MissionObjective = (typeof MISSION_OBJECTIVES)[number];
