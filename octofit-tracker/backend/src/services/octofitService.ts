import { isValidObjectId } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function workoutReason(base: string, focus: string) {
  return `${base} based on your recent ${focus} activity pattern and goal.`;
}

export async function listActivities() {
  return Activity.find().sort({ occurredAt: -1 }).lean();
}

export async function createActivity(input: unknown) {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const minutesValue = Number(body.minutes);

  if (!userId || !teamId || !type || !Number.isFinite(minutesValue) || minutesValue <= 0 || !isValidObjectId(userId) || !isValidObjectId(teamId)) {
    throw badRequest('Invalid activity payload');
  }

  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) {
    throw badRequest('Unknown user or team');
  }

  const points = Math.max(1, Math.round(minutesValue * 1));
  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type,
    minutes: minutesValue,
    points,
    occurredAt: new Date(),
  });

  return activity.toObject();
}

export async function listTeams() {
  return Team.find().sort({ name: 1 }).lean();
}

export async function createTeam(input: unknown) {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const mascot = typeof body.mascot === 'string' ? body.mascot.trim() : '';
  const members = Array.isArray(body.members) ? body.members : [];

  if (!isNonEmptyString(name) || !isNonEmptyString(mascot)) {
    throw badRequest('Team name and mascot are required');
  }

  const validMembers = members.filter((member): member is string => typeof member === 'string' && isValidObjectId(member));
  const team = await Team.create({ name, mascot, members: validMembers });
  return team.toObject();
}

export async function getLeaderboard() {
  const summary = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $sort: { totalPoints: -1, _id: 1 } },
  ]);

  const leaderboard = [] as Array<{ teamName: string; totalPoints: number; rank: number }>;
  for (const [index, item] of summary.entries()) {
    const team = await Team.findById(item._id).lean();
    if (!team) continue;
    leaderboard.push({
      teamName: team.name,
      totalPoints: Number(item.totalPoints) || 0,
      rank: index + 1,
    });
  }

  return leaderboard;
}

export async function suggestWorkouts(userEmail: string) {
  const email = normalizeEmail(userEmail);
  const user = await User.findOne({ email }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivities = await Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(5).lean();
  const baseFocus = recentActivities[0]?.type ? String(recentActivities[0].type).toLowerCase() : '';
  const preferredFocus = user.fitnessGoal ? String(user.fitnessGoal).toLowerCase() : '';

  const workouts = await Workout.find().lean();
  const normalizedWorkouts = workouts
    .map((workout) => {
      const focus = String(workout.focus ?? '').toLowerCase();
      let score = 0;
      if (focus === baseFocus) score += 5;
      if (focus === preferredFocus) score += 4;
      if (baseFocus && focus.includes(baseFocus)) score += 2;
      if (preferredFocus && focus.includes(preferredFocus)) score += 2;
      return { ...workout, score };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const suggestions = normalizedWorkouts.map((workout) => {
    const focus = String(workout.focus ?? '').toLowerCase();
    const reason = workoutReason(baseFocus || preferredFocus || 'your recent activity', focus);
    return { ...workout, reason };
  });

  return suggestions;
}

export { User };
