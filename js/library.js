// Built-in exercise library, grouped by movement / muscle group.
// Bump LIBRARY_VERSION after adding names so existing installs receive them.
export const LIBRARY_VERSION = 1;

export const EXERCISE_LIBRARY = {
  Squat: [
    'Squat', 'High-Bar Squat', 'Low-Bar Squat', 'Front Squat', 'Safety Bar Squat', 'Cambered Bar Squat',
    'Box Squat', 'Pause Squat', 'Pin Squat', 'Anderson Squat', 'Tempo Squat', 'Zercher Squat', 'Overhead Squat',
    'Heel-Elevated Squat', 'Goblet Squat', 'Dumbbell Squat', 'Landmine Squat', 'Belt Squat', 'Hack Squat (Machine)',
    'Barbell Hack Squat', 'Smith Machine Squat', 'Pendulum Squat', 'Leg Press', 'Single-Leg Leg Press',
    'Bodyweight Squat', 'Jump Squat', 'Sissy Squat',
  ],
  Hinge: [
    'Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift', 'Romanian Deadlift', 'Stiff-Leg Deadlift', 'Deficit Deadlift',
    'Pause Deadlift', 'Snatch-Grip Deadlift', 'Block Pull', 'Rack Pull', 'Dumbbell Romanian Deadlift',
    'Single-Leg Romanian Deadlift', 'Kettlebell Deadlift', 'Good Morning', 'Safety Bar Good Morning', 'Seated Good Morning',
    'Hip Thrust', 'Single-Leg Hip Thrust', 'Barbell Glute Bridge', 'Cable Pull-Through', 'Kettlebell Swing',
    'Back Extension', '45° Back Extension', 'Reverse Hyperextension', 'Glute-Ham Raise', 'Nordic Hamstring Curl', 'Jefferson Curl',
  ],
  'Bench & Chest': [
    'Bench Press', 'Close-Grip Bench Press', 'Wide-Grip Bench Press', 'Paused Bench Press', 'Spoto Press', 'Larsen Press',
    'Pin Press', 'Board Press', 'Floor Press', 'Reverse-Grip Bench Press', 'Swiss Bar Bench Press', 'Incline Bench Press',
    'Close-Grip Incline Bench Press', 'Decline Bench Press', 'Smith Machine Bench Press', 'Dumbbell Bench Press',
    'Incline Dumbbell Press', 'Decline Dumbbell Press', 'Dumbbell Floor Press', 'Machine Chest Press', 'Push-up',
    'Weighted Push-up', 'Deficit Push-up', 'Diamond Push-up', 'Dip', 'Weighted Dip', 'Ring Dip', 'Bench Dip',
    'Dumbbell Fly', 'Incline Dumbbell Fly', 'Cable Fly', 'Low-to-High Cable Fly', 'Pec Deck',
  ],
  'Overhead & Shoulders': [
    'Overhead Press', 'Push Press', 'Seated Overhead Press', 'Behind-the-Neck Press', 'Z Press', 'Bradford Press',
    'Viking Press', 'Landmine Press', 'Half-Kneeling Landmine Press', 'Dumbbell Shoulder Press', 'Seated Dumbbell Press',
    'Single-Arm Dumbbell Press', 'Arnold Press', 'Kettlebell Press', 'Machine Shoulder Press', 'Handstand Push-up',
    'Pike Push-up', 'Lateral Raise', 'Cable Lateral Raise', 'Lean-Away Lateral Raise', 'Machine Lateral Raise',
    'Front Raise', 'Plate Front Raise', 'Upright Row', 'Rear Delt Fly', 'Reverse Pec Deck', 'Face Pull',
    'Band Pull-Apart', 'Y-Raise', 'Cuban Press', 'Cable External Rotation',
  ],
  Back: [
    'Chin-up', 'Weighted Chin-up', 'Pull-up', 'Weighted Pull-up', 'Wide-Grip Pull-up', 'Neutral-Grip Pull-up',
    'Assisted Pull-up', 'Lat Pulldown', 'Close-Grip Lat Pulldown', 'Neutral-Grip Lat Pulldown', 'Single-Arm Lat Pulldown',
    'Straight-Arm Pulldown', 'Barbell Row', 'Pendlay Row', 'Yates Row', 'Seal Row', 'T-Bar Row', 'Meadows Row',
    'Chest-Supported Row', 'Chest-Supported Dumbbell Row', 'Dumbbell Row', 'Kroc Row', 'Seated Cable Row',
    'Single-Arm Cable Row', 'Machine Row', 'Inverted Row', 'Ring Row', 'Barbell Shrug', 'Dumbbell Shrug', 'Trap Bar Shrug',
  ],
  Legs: [
    'Lunge', 'Walking Lunge', 'Reverse Lunge', 'Barbell Reverse Lunge', 'Deficit Reverse Lunge', 'Lateral Lunge',
    'Split Squat', 'Bulgarian Split Squat', 'Front-Foot Elevated Split Squat', 'Step-up', 'Lateral Step-up',
    'Pistol Squat', 'Single-Leg Box Squat', 'Leg Extension', 'Lying Leg Curl', 'Seated Leg Curl', 'Standing Leg Curl',
    'Hip Adduction (Machine)', 'Hip Abduction (Machine)', 'Standing Calf Raise', 'Seated Calf Raise',
    'Single-Leg Calf Raise', 'Leg Press Calf Raise', 'Tibialis Raise', 'Sled Push', 'Sled Drag',
  ],
  Arms: [
    'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl',
    'Concentration Curl', 'Spider Curl', 'Cable Curl', 'Bayesian Curl', 'Reverse Curl', 'Zottman Curl',
    'Triceps Pushdown', 'Rope Pushdown', 'Overhead Cable Triceps Extension', 'Overhead Dumbbell Triceps Extension',
    'Skull Crusher', 'EZ-Bar Skull Crusher', 'Dumbbell Skull Crusher', 'JM Press', 'Tate Press', 'Dumbbell Kickback',
    'Close-Grip Push-up', 'Wrist Curl', 'Reverse Wrist Curl',
  ],
  Core: [
    'Hanging Leg Raise', 'Hanging Knee Raise', 'Toes-to-Bar', 'Lying Leg Raise', 'Ab Wheel', 'Plank', 'Weighted Plank',
    'Side Plank', 'Copenhagen Plank', 'Dead Bug', 'Bird Dog', 'Hollow Hold', 'L-Sit', 'Dragon Flag', 'Crunch',
    'Cable Crunch', 'Decline Sit-up', 'Weighted Sit-up', 'Russian Twist', 'Pallof Press', 'Cable Woodchopper',
    'Landmine Rotation', 'Side Bend',
  ],
  'Olympic & Power': [
    'Power Clean', 'Hang Clean', 'Hang Power Clean', 'Clean', 'Clean Pull', 'Power Snatch', 'Hang Snatch',
    'Hang Power Snatch', 'Snatch', 'Snatch Pull', 'Clean and Jerk', 'Push Jerk', 'Split Jerk', 'High Pull',
    'Box Jump', 'Broad Jump', 'Medicine Ball Slam', 'Medicine Ball Chest Pass', 'Kettlebell Snatch', 'Kettlebell Clean',
  ],
  'Carries & Grip': [
    "Farmer's Carry", 'Trap Bar Carry', 'Suitcase Carry', 'Front Rack Carry', 'Overhead Carry', 'Yoke Carry',
    'Sandbag Carry', 'Dead Hang', 'Plate Pinch', 'Towel Hang',
  ],
};

export const OTHER_GROUP = 'Other';
export const GROUPS = [...Object.keys(EXERCISE_LIBRARY), OTHER_GROUP];

const byName = new Map();
for (const [group, names] of Object.entries(EXERCISE_LIBRARY)) for (const n of names) byName.set(n.toLowerCase(), group);

export function groupOf(name) {
  return byName.get(String(name || '').trim().toLowerCase()) || OTHER_GROUP;
}
