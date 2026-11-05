import type { Muscle } from "./muscles";

/**
 * weight      a load is entered for every set (barbell, dumbbell, cable, machine)
 * bodyweight  the load is optional added weight; 0 means bodyweight only
 * time        the "reps" column holds seconds, no load
 * cardio      a machine bout: "reps" holds the time in seconds, plus the fields in `cardio`
 */
export type Measure = "weight" | "bodyweight" | "time" | "cardio";

/** Numbers a cardio machine logs besides time. Calories and heart rate are offered for all of them. */
export type CardioField = "km" | "m" | "incline" | "level" | "floors";

export type Exercise = {
  id: string;
  name: string;
  equipment: string;
  primary: Muscle[];
  secondary: Muscle[];
  measure: Measure;
  /** Default prescription when added to a routine */
  sets: number;
  reps: number;
  steps: string[];
  cues: string[];
  /** Built-in exercises have two drawings: /ex/<id>-a.webp (stretched) and -b.webp (contracted) */
  image: boolean;
  custom?: boolean;
  /** Cardio machines: the columns shown for each bout */
  cardio?: CardioField[];
  /** Other names people search for ("stair stepper", "cycling"), matched by the exercise search */
  aliases?: string[];
};

type Def = Omit<Exercise, "image" | "measure" | "secondary"> & {
  measure?: Measure;
  secondary?: Muscle[];
  /** false for exercises with no drawing in the image set; they show initials instead */
  image?: boolean;
};

const d = (e: Def): Exercise => ({ measure: "weight", secondary: [], image: true, ...e });
const c = (e: Omit<Def, "measure" | "sets" | "reps"> & { cardio: CardioField[]; minutes: number }): Exercise => {
  const { minutes, ...rest } = e;
  return { secondary: [], ...rest, measure: "cardio", sets: 1, reps: minutes * 60, image: false };
};

export const IMAGE_CREDIT = {
  text: "Illustrations: Everkinetic (Greg Priday), CC BY-SA 4.0, recoloured",
  href: "https://github.com/everkinetic/data",
};

export const EXERCISES: Exercise[] = [
  // ---------------- Chest ----------------
  d({
    id: "bench-press", name: "Barbell Bench Press", equipment: "Barbell",
    primary: ["chest"], secondary: ["triceps", "shoulders"], sets: 3, reps: 8,
    steps: [
      "Lie on a flat bench with your eyes under the bar and your feet planted on the floor.",
      "Grip the bar slightly wider than shoulder width and pull your shoulder blades back and down.",
      "Unrack and hold the bar over your shoulders with straight arms.",
      "Lower it under control to your mid-chest, elbows about 45° from your body.",
      "Press back up until your arms are straight.",
    ],
    cues: [
      "Keep your upper back tight and your glutes on the bench.",
      "Wrists stacked over elbows; don't let the bar roll back in your hands.",
      "Use safety arms or a spotter when it gets heavy.",
    ],
  }),
  d({
    id: "incline-bench-press", name: "Incline Barbell Bench Press", equipment: "Barbell",
    primary: ["chest"], secondary: ["shoulders", "triceps"], sets: 3, reps: 8,
    steps: [
      "Set the bench to 30–45° and lie back with your eyes just under the bar.",
      "Grip slightly wider than shoulder width and set your shoulder blades back and down.",
      "Unrack and hold the bar over your upper chest.",
      "Lower it to the top of your chest, just below the collarbones.",
      "Press straight up until your arms are extended.",
    ],
    cues: [
      "A lower incline (about 30°) keeps the work on the upper chest rather than the shoulders.",
      "Keep your feet planted and your hips on the seat.",
    ],
  }),
  d({
    id: "dumbbell-bench-press", name: "Dumbbell Bench Press", equipment: "Dumbbell",
    primary: ["chest"], secondary: ["triceps", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Sit on a flat bench with the dumbbells on your thighs, then lie back and bring them to your chest.",
      "Press them up over your chest, palms facing your feet.",
      "Lower the weights out to the sides of your chest until you feel a stretch.",
      "Press back up and slightly inward until they nearly touch.",
    ],
    cues: [
      "Dumbbells allow a deeper stretch than a bar, so lower slowly.",
      "To finish, bring the weights back to your chest and sit up rather than dropping them out wide.",
    ],
  }),
  d({
    id: "incline-dumbbell-press", name: "Incline Dumbbell Press", equipment: "Dumbbell",
    primary: ["chest"], secondary: ["shoulders", "triceps"], sets: 3, reps: 10,
    steps: [
      "Set the bench to 30–45° and lie back with a dumbbell at each shoulder.",
      "Press the weights up over your upper chest until your arms are straight.",
      "Lower them under control until they're level with your chest.",
      "Keep your elbows slightly tucked rather than flared straight out to the sides.",
    ],
    cues: [
      "Let the dumbbells drift together at the top, but don't clank them.",
      "Keep your shoulder blades pinned to the bench.",
    ],
  }),
  d({
    id: "dumbbell-fly", name: "Dumbbell Fly", equipment: "Dumbbell",
    primary: ["chest"], secondary: ["shoulders"], sets: 3, reps: 12,
    steps: [
      "Lie on a bench holding dumbbells above your chest, palms facing each other.",
      "With a slight, fixed bend in your elbows, open your arms out wide in an arc.",
      "Stop when your upper arms are level with your torso and you feel a stretch across your chest.",
      "Squeeze your chest to bring the weights back up along the same arc.",
    ],
    cues: [
      "Think of hugging a big tree: the elbow angle never changes.",
      "Use lighter weights than you press with.",
    ],
  }),
  d({
    id: "cable-crossover", name: "Cable Crossover", equipment: "Cable",
    primary: ["chest"], secondary: ["shoulders"], sets: 3, reps: 12,
    steps: [
      "Set both pulleys high, take a handle in each hand and step forward into a split stance.",
      "Lean slightly forward with a soft bend in your elbows and your arms open wide.",
      "Pull the handles down and together in an arc until your hands meet in front of your hips.",
      "Pause and squeeze, then let your arms open back slowly.",
    ],
    cues: [
      "Keep your torso still; only your arms move.",
      "Lower pulleys shift the work to the upper chest.",
    ],
  }),
  d({
    id: "push-up", name: "Push-Up", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["chest"], secondary: ["triceps", "shoulders", "abs"], sets: 3, reps: 12,
    steps: [
      "Place your hands slightly wider than your shoulders with your legs straight behind you.",
      "Brace your abs and glutes so your body forms one straight line.",
      "Lower until your chest is just above the floor, elbows about 45° from your body.",
      "Push the floor away until your arms are straight.",
    ],
    cues: [
      "Don't let your hips sag or pike up.",
      "Hands on a bench makes it easier; feet on a bench makes it harder.",
      "Leave the weight at 0, or log a plate on your back as added weight.",
    ],
  }),
  d({
    id: "dip", name: "Parallel-Bar Dip", equipment: "Dip bars", measure: "bodyweight",
    primary: ["chest", "triceps"], secondary: ["shoulders"], sets: 3, reps: 8,
    steps: [
      "Grip the bars and press up to straight arms, shoulders pulled down away from your ears.",
      "Lean your torso slightly forward and bend your knees.",
      "Lower until your upper arms are about parallel to the floor.",
      "Press back up to straight arms.",
    ],
    cues: [
      "More forward lean works more chest; staying upright works more triceps.",
      "Stop higher if you feel pain at the front of your shoulder.",
      "Log weight from a dip belt as added weight, or 0 for bodyweight.",
    ],
  }),

  d({
    id: "decline-bench-press", name: "Decline Barbell Bench Press", equipment: "Barbell",
    primary: ["chest"], secondary: ["triceps", "shoulders"], sets: 3, reps: 8,
    steps: [
      "Hook your legs under the pads of a decline bench and lie back with your eyes under the bar.",
      "Grip slightly wider than shoulder width and set your shoulder blades back and down.",
      "Unrack and hold the bar over your lower chest with straight arms.",
      "Lower it under control to the bottom of your chest.",
      "Press back up until your arms are straight.",
    ],
    cues: ["A spotter helps here: racking the bar from a decline is awkward.", "Keep the decline mild (15–30°)."],
  }),
  d({
    id: "machine-chest-press", name: "Machine Chest Press", equipment: "Machine",
    primary: ["chest"], secondary: ["triceps", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Set the seat so the handles line up with your mid-chest.",
      "Sit with your back against the pad and grip the handles.",
      "Press forward until your arms are straight, without locking out hard.",
      "Return slowly until you feel a stretch across your chest.",
    ],
    cues: ["Keep your shoulder blades pinned to the pad.", "A good place to push close to failure safely."],
  }),
  d({
    id: "incline-dumbbell-fly", name: "Incline Dumbbell Fly", equipment: "Dumbbell",
    primary: ["chest"], secondary: ["shoulders"], sets: 3, reps: 12,
    steps: [
      "Lie on a bench set to 30–45° with a dumbbell in each hand over your upper chest, palms facing.",
      "With a slight bend in your elbows, open your arms in a wide arc.",
      "Stop when you feel a stretch across your chest, about level with the bench.",
      "Squeeze the dumbbells back up along the same arc.",
    ],
    cues: ["Keep the elbow bend fixed: it's a hug, not a press.", "Go lighter than you would for presses."],
  }),
  d({
    id: "dumbbell-pullover", name: "Dumbbell Pullover", equipment: "Dumbbell",
    primary: ["chest", "back"], secondary: ["triceps", "abs"], sets: 3, reps: 12,
    steps: [
      "Lie across or along a bench holding one dumbbell over your chest with both hands.",
      "With a slight bend in your elbows, lower it back behind your head in an arc.",
      "Stop when your arms are in line with your body and you feel a stretch.",
      "Pull it back over your chest along the same arc.",
    ],
    cues: ["Keep your ribs down; don't arch to get more range.", "Cup the inside of the top plate with both palms."],
  }),

  // ---------------- Shoulders ----------------
  d({
    id: "seated-overhead-press", name: "Seated Barbell Overhead Press", equipment: "Barbell",
    primary: ["shoulders"], secondary: ["triceps", "traps"], sets: 3, reps: 8,
    steps: [
      "Sit on an upright bench with your back supported and your feet flat.",
      "Hold the bar at upper-chest height, hands just wider than your shoulders.",
      "Press it straight overhead until your arms are locked out.",
      "Lower it under control back to your upper chest.",
    ],
    cues: [
      "Tip your head back slightly so the bar can travel in a straight line.",
      "Don't arch hard away from the backrest.",
    ],
  }),
  d({
    id: "single-arm-dumbbell-press", name: "Single-Arm Dumbbell Press", equipment: "Dumbbell",
    primary: ["shoulders"], secondary: ["triceps", "obliques"], sets: 3, reps: 10,
    steps: [
      "Stand tall holding a dumbbell at shoulder height, palm facing forward; rest your other hand on your hip.",
      "Brace your core and squeeze your glutes.",
      "Press the dumbbell straight overhead until your arm is straight.",
      "Lower it back to your shoulder. Finish the set, then switch arms.",
    ],
    cues: [
      "Don't lean away from the weight; resisting that also trains your core.",
      "Log the reps for one arm.",
    ],
  }),
  d({
    id: "lateral-raise", name: "Lateral Raise", equipment: "Dumbbell",
    primary: ["shoulders"], secondary: ["traps"], sets: 3, reps: 12,
    steps: [
      "Stand with a dumbbell in each hand at your sides, elbows slightly bent.",
      "Raise the weights out to the sides until your arms are level with your shoulders.",
      "Lead with your elbows; your hands shouldn't rise above them.",
      "Lower slowly over two to three seconds.",
    ],
    cues: [
      "Light weight and strict form. Swinging moves the work to your traps.",
      "A slight forward lean keeps tension on the side of the shoulder.",
    ],
  }),
  d({
    id: "front-raise", name: "Front Raise", equipment: "Dumbbell",
    primary: ["shoulders"], secondary: ["chest"], sets: 3, reps: 12,
    steps: [
      "Stand with the dumbbells in front of your thighs.",
      "Raise one or both weights straight in front of you to shoulder height.",
      "Keep a slight bend in your elbows and your torso still.",
      "Lower under control.",
    ],
    cues: [
      "If you already press heavy, your front delts get plenty of work; keep these light.",
    ],
  }),
  d({
    id: "reverse-fly", name: "Reverse Dumbbell Fly", equipment: "Dumbbell",
    primary: ["shoulders", "back"], secondary: ["traps"], sets: 3, reps: 12,
    steps: [
      "Hinge forward until your torso is nearly parallel to the floor, resting your forehead on a bench if you like.",
      "Let the dumbbells hang below your chest, palms facing each other.",
      "With a slight bend in your elbows, raise your arms out to the sides until they're level with your back.",
      "Squeeze your shoulder blades together, then lower slowly.",
    ],
    cues: [
      "Targets the rear delts and upper back, which most pressing neglects.",
      "Use light weights and pause at the top.",
    ],
  }),

  d({
    id: "overhead-press", name: "Standing Barbell Overhead Press", equipment: "Barbell", image: false,
    aliases: ["ohp", "military press", "press", "shoulder press"],
    primary: ["shoulders"], secondary: ["triceps", "traps", "abs"], sets: 3, reps: 5,
    steps: [
      "Set the bar in a rack at upper-chest height and grip it just wider than your shoulders.",
      "Unrack it onto the front of your shoulders and step back, feet about hip width apart.",
      "Brace your abs and glutes, then press the bar straight up, moving your head back out of the way.",
      "Lock out overhead with the bar over your mid-foot, then lower it back to your shoulders.",
    ],
    cues: ["Squeeze your glutes so you don't lean back.", "Push your head through once the bar passes your forehead."],
  }),
  d({
    id: "upright-row", name: "Barbell Upright Row", equipment: "Barbell",
    primary: ["shoulders", "traps"], secondary: ["biceps"], sets: 3, reps: 12,
    steps: [
      "Stand holding a barbell in front of your thighs with an overhand grip, hands about shoulder width.",
      "Lead with your elbows and pull the bar up close to your body.",
      "Stop when your elbows are at shoulder height.",
      "Lower it under control.",
    ],
    cues: ["A wider grip is kinder to the shoulders.", "Stop at shoulder height; higher pinches the joint."],
  }),
  d({
    id: "face-pull", name: "Face Pull", equipment: "Cable", image: false,
    primary: ["shoulders"], secondary: ["traps", "back"], sets: 3, reps: 15,
    steps: [
      "Set a rope on a cable at head height and grip it with thumbs pointing back toward you.",
      "Step back so the weight is off the stack, arms straight in front of you.",
      "Pull the rope toward your face, splitting it apart and pulling your hands past your ears.",
      "Pause, then let it back out slowly.",
    ],
    cues: ["Elbows high, ending like a double-biceps pose.", "Light and controlled: it's for your rear delts and shoulder health."],
  }),

  // ---------------- Traps ----------------
  d({
    id: "barbell-shrug", name: "Barbell Shrug", equipment: "Barbell",
    primary: ["traps"], secondary: ["forearms"], sets: 3, reps: 12,
    steps: [
      "Stand holding a barbell in front of your thighs, hands shoulder-width apart.",
      "Keep your arms straight and shrug your shoulders straight up toward your ears.",
      "Hold the top for a second.",
      "Lower slowly to a full stretch.",
    ],
    cues: [
      "Straight up and down; rolling your shoulders adds nothing.",
      "Lifting straps help if your grip gives out first.",
    ],
  }),
  d({
    id: "dumbbell-shrug", name: "Dumbbell Shrug", equipment: "Dumbbell",
    primary: ["traps"], secondary: ["forearms"], sets: 3, reps: 12,
    steps: [
      "Stand tall with a dumbbell in each hand at your sides.",
      "Shrug your shoulders straight up as high as you can.",
      "Pause at the top.",
      "Lower until you feel a stretch in your traps.",
    ],
    cues: ["Holding the weights at your sides lets your shoulders move naturally."],
  }),

  // ---------------- Back ----------------
  d({
    id: "deadlift", name: "Barbell Deadlift", equipment: "Barbell",
    primary: ["lowerBack", "glutes", "hamstrings"], secondary: ["back", "traps", "quads", "forearms"],
    sets: 3, reps: 5,
    steps: [
      "Stand with the bar over your mid-foot, feet about hip-width apart.",
      "Hinge down and grip the bar just outside your legs, then bend your knees until your shins touch it.",
      "Flatten your back, lift your chest and pull the slack out of the bar.",
      "Push the floor away and stand up, keeping the bar close to your legs.",
      "Lower it by pushing your hips back first, bending your knees once the bar passes them.",
    ],
    cues: [
      "Your back stays neutral from start to finish.",
      "Finish by squeezing your glutes; don't lean back at the top.",
    ],
  }),
  d({
    id: "barbell-row", name: "Bent-Over Barbell Row", equipment: "Barbell",
    primary: ["back"], secondary: ["shoulders", "biceps", "lowerBack"], sets: 3, reps: 8,
    steps: [
      "Hold a barbell overhand, hands a little wider than your shoulders.",
      "Hinge forward to about 45° or lower, knees soft and back flat.",
      "Pull the bar to your lower chest, driving your elbows back.",
      "Lower until your arms are straight, keeping your torso still.",
    ],
    cues: [
      "Squeeze your shoulder blades together at the top.",
      "If your torso rises with each rep, the weight is too heavy.",
    ],
  }),
  d({
    id: "pull-up", name: "Pull-Up", equipment: "Pull-up bar", measure: "bodyweight",
    primary: ["back"], secondary: ["biceps", "forearms"], sets: 3, reps: 8,
    steps: [
      "Hang from the bar with an overhand grip, hands wider than your shoulders.",
      "Start by pulling your shoulders down and back.",
      "Pull until your chin clears the bar, driving your elbows down to your sides.",
      "Lower all the way to a dead hang.",
    ],
    cues: [
      "No kipping; control the way down.",
      "Use a band or an assisted machine to build up to bodyweight reps.",
      "Log a dip belt as added weight, or 0 for bodyweight.",
    ],
  }),
  d({
    id: "chin-up", name: "Neutral-Grip Chin-Up", equipment: "Pull-up bar", measure: "bodyweight",
    primary: ["back", "biceps"], secondary: ["forearms"], sets: 3, reps: 8,
    steps: [
      "Hang from parallel handles with your palms facing each other, hands close together.",
      "Pull your shoulders down away from your ears.",
      "Pull yourself up until your chin passes the handles.",
      "Lower under control to straight arms.",
    ],
    cues: [
      "Easier on the shoulders and elbows than a wide grip.",
      "Palms facing you on a straight bar works the same way.",
    ],
  }),
  d({
    id: "lat-pulldown", name: "Lat Pulldown", equipment: "Cable",
    primary: ["back"], secondary: ["biceps"], sets: 3, reps: 10,
    steps: [
      "Attach a V-handle or bar, sit down and lock your thighs under the pads.",
      "Grip the handle with your arms fully stretched overhead.",
      "Lean back slightly and pull the handle to your upper chest, elbows driving down.",
      "Let it rise slowly until your arms are straight again.",
    ],
    cues: [
      "Pull with your elbows, not your hands.",
      "The drawing shows the close-grip V-handle; a wide bar works the same way.",
    ],
  }),
  d({
    id: "seated-cable-row", name: "Seated Cable Row", equipment: "Cable",
    primary: ["back"], secondary: ["biceps", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Sit at the row station with your feet on the platform and knees slightly bent.",
      "Grab the handle with straight arms and sit tall.",
      "Pull the handle to your stomach, squeezing your shoulder blades together.",
      "Let your arms extend forward slowly until you feel a stretch in your back.",
    ],
    cues: ["Keep your torso nearly upright; don't rock back to move the weight."],
  }),
  d({
    id: "t-bar-row", name: "T-Bar Row", equipment: "Machine",
    primary: ["back"], secondary: ["biceps", "lowerBack"], sets: 3, reps: 8,
    steps: [
      "Stand on the platform or straddle the bar and grip the handles.",
      "Hinge forward with a flat back and soft knees.",
      "Pull the weight toward your chest, keeping your elbows close.",
      "Lower until your arms are straight.",
    ],
    cues: ["A chest-supported version takes the strain off your lower back."],
  }),
  d({
    id: "one-arm-dumbbell-row", name: "One-Arm Dumbbell Row", equipment: "Dumbbell",
    primary: ["back"], secondary: ["biceps", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Put one knee and the same-side hand on a flat bench, back flat.",
      "Hold a dumbbell in the other hand with your arm hanging straight.",
      "Row the weight toward your hip, keeping your elbow close to your body.",
      "Lower until your arm is straight. Finish the set, then switch sides.",
    ],
    cues: [
      "Pull toward your hip, not your armpit.",
      "Don't twist your torso to lift the weight.",
      "Log the reps for one arm.",
    ],
  }),
  d({
    id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", equipment: "Cable",
    primary: ["back"], secondary: ["triceps", "abs"], sets: 3, reps: 12,
    steps: [
      "Attach a straight bar or rope to a high pulley and stand facing it.",
      "Grip it with straight arms at about eye level and hinge slightly at the hips.",
      "Keeping your arms straight, sweep the bar down to your thighs.",
      "Let it return slowly to the start.",
    ],
    cues: ["Your elbows stay nearly locked, so the lats do all the work."],
  }),

  d({
    id: "inverted-row", name: "Inverted Row", equipment: "Bar", measure: "bodyweight",
    aliases: ["body row", "australian pull-up"],
    primary: ["back"], secondary: ["biceps", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Set a bar at about hip height in a rack or Smith machine and lie underneath it.",
      "Grip it slightly wider than your shoulders and straighten your body, heels on the floor.",
      "Pull your chest up to the bar, squeezing your shoulder blades together.",
      "Lower until your arms are straight.",
    ],
    cues: ["Keep a straight line from head to heels.", "Lower the bar or bend your knees to make it easier."],
  }),
  d({
    id: "close-grip-lat-pulldown", name: "Close-Grip Lat Pulldown", equipment: "Cable",
    aliases: ["v-bar pulldown"],
    primary: ["back"], secondary: ["biceps"], sets: 3, reps: 10,
    steps: [
      "Attach a V-bar to the high pulley and sit with your thighs under the pads.",
      "Grip the handles with palms facing and arms straight overhead.",
      "Pull the handle to your upper chest, leaning back slightly and driving your elbows down.",
      "Let it rise under control until your arms are straight.",
    ],
    cues: ["Think of pulling with your elbows, not your hands."],
  }),

  // ---------------- Lower back ----------------
  d({
    id: "back-extension", name: "Back Extension", equipment: "Hyperextension bench", measure: "bodyweight",
    primary: ["lowerBack"], secondary: ["glutes", "hamstrings"], sets: 3, reps: 12,
    steps: [
      "Set the pad just below your hips and lock your feet in.",
      "Cross your arms over your chest and lower your upper body toward the floor.",
      "Raise your torso until your body forms a straight line.",
      "Pause, then lower under control.",
    ],
    cues: [
      "Stop at straight; don't arch past it.",
      "Hold a plate to your chest and log it as added weight.",
    ],
  }),
  d({
    id: "good-morning", name: "Good Morning", equipment: "Barbell",
    primary: ["lowerBack", "hamstrings"], secondary: ["glutes"], sets: 3, reps: 10,
    steps: [
      "Set a light barbell across your upper back as you would for a squat.",
      "With your knees softly bent, push your hips back and hinge forward.",
      "Lower your torso until it's nearly parallel to the floor or your hamstrings stop you.",
      "Drive your hips forward to stand back up.",
    ],
    cues: ["Start light. Your back stays flat throughout."],
  }),
  d({
    id: "superman", name: "Superman", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["lowerBack"], secondary: ["glutes"], sets: 3, reps: 12,
    steps: [
      "Lie face down with your arms stretched out in front of you.",
      "Lift your arms, chest and legs off the floor at the same time.",
      "Hold for two seconds at the top.",
      "Lower slowly and repeat.",
    ],
    cues: ["Keep your neck in line with your spine, eyes on the floor."],
  }),

  // ---------------- Biceps ----------------
  d({
    id: "barbell-curl", name: "Barbell Curl", equipment: "Barbell",
    primary: ["biceps"], secondary: ["forearms"], sets: 3, reps: 10,
    steps: [
      "Stand holding a barbell with an underhand grip, hands shoulder-width apart.",
      "Pin your elbows to your sides.",
      "Curl the bar up toward your shoulders.",
      "Squeeze, then lower slowly to straight arms.",
    ],
    cues: [
      "If your back sways to lift it, go lighter.",
      "An EZ bar is easier on the wrists.",
    ],
  }),
  d({
    id: "dumbbell-curl", name: "Dumbbell Curl", equipment: "Dumbbell",
    primary: ["biceps"], secondary: ["forearms"], sets: 3, reps: 10,
    steps: [
      "Stand with a dumbbell in each hand, palms facing forward.",
      "Curl both weights, or one at a time, up toward your shoulders without moving your elbows.",
      "Squeeze at the top.",
      "Lower slowly until your arms are straight.",
    ],
    cues: ["Turning your little finger up slightly at the top gives a stronger squeeze."],
  }),
  d({
    id: "hammer-curl", name: "Hammer Curl", equipment: "Dumbbell",
    primary: ["biceps", "forearms"], sets: 3, reps: 10,
    steps: [
      "Stand with the dumbbells at your sides, palms facing your body.",
      "Keeping that grip, curl the weights up toward your shoulders.",
      "Pause at the top.",
      "Lower under control.",
    ],
    cues: ["The neutral grip builds the brachialis and forearms as well as the biceps."],
  }),
  d({
    id: "preacher-curl", name: "Preacher Curl", equipment: "Barbell",
    primary: ["biceps"], sets: 3, reps: 10,
    steps: [
      "Sit at a preacher bench with the backs of your upper arms flat on the pad.",
      "Hold the bar with an underhand grip and your arms nearly straight.",
      "Curl the bar up until your forearms are close to vertical.",
      "Lower slowly, stopping just short of locking out.",
    ],
    cues: [
      "The pad stops you cheating, so the weight will be lighter than a standing curl.",
      "Go slowest at the bottom, where the stretch is greatest.",
    ],
  }),
  d({
    id: "concentration-curl", name: "Concentration Curl", equipment: "Dumbbell",
    primary: ["biceps"], sets: 3, reps: 12,
    steps: [
      "Sit on a bench with your feet wide and lean forward.",
      "Brace the back of your upper arm against your inner thigh with the dumbbell hanging down.",
      "Curl the dumbbell up toward your shoulder.",
      "Squeeze, then lower slowly. Finish the set, then switch arms.",
    ],
    cues: ["Your upper arm stays still against your leg the whole time."],
  }),
  d({
    id: "cable-curl", name: "Cable Curl", equipment: "Cable",
    primary: ["biceps"], secondary: ["forearms"], sets: 3, reps: 12,
    steps: [
      "Attach a straight bar to a low pulley and stand facing it.",
      "Grip underhand with your arms straight and elbows by your sides.",
      "Curl the bar up to your chest.",
      "Lower slowly against the pull of the cable.",
    ],
    cues: ["The cable keeps tension on the biceps through the whole rep."],
  }),
  d({
    id: "incline-dumbbell-curl", name: "Incline Dumbbell Curl", equipment: "Dumbbell",
    primary: ["biceps"], sets: 3, reps: 10,
    steps: [
      "Sit back on a bench set to about 45° with a dumbbell in each hand, arms hanging straight down.",
      "Keep your upper arms still and curl the weights up.",
      "Squeeze at the top.",
      "Lower all the way to a full stretch.",
    ],
    cues: ["The long stretch at the bottom means lighter weights than standing curls."],
  }),

  d({
    id: "ez-bar-curl", name: "EZ-Bar Curl", equipment: "Barbell",
    primary: ["biceps"], secondary: ["forearms"], sets: 3, reps: 10,
    steps: [
      "Stand holding an EZ bar on the angled grips, palms up, arms straight.",
      "Keep your elbows at your sides and curl the bar up to your shoulders.",
      "Squeeze, then lower it slowly until your arms are straight.",
    ],
    cues: ["The angled grip is easier on the wrists than a straight bar.", "No swinging: keep your torso still."],
  }),

  // ---------------- Triceps ----------------
  d({
    id: "rope-pushdown", name: "Rope Pushdown", equipment: "Cable",
    primary: ["triceps"], sets: 3, reps: 12,
    steps: [
      "Attach a rope to a high pulley and grip the ends, palms facing each other.",
      "Stand tall with your elbows tucked at your sides.",
      "Push the rope down until your arms are straight, spreading the ends apart at the bottom.",
      "Let your forearms rise back up slowly while your elbows stay still.",
    ],
    cues: ["Only your forearms move."],
  }),
  d({
    id: "triceps-pushdown", name: "Triceps Pushdown", equipment: "Cable",
    primary: ["triceps"], sets: 3, reps: 12,
    steps: [
      "Attach a straight bar or V-bar to a high pulley and grip it overhand.",
      "Pin your elbows to your sides with your forearms about parallel to the floor.",
      "Push the bar down until your arms are fully straight.",
      "Return slowly to the start.",
    ],
    cues: ["Leaning forward slightly can help keep your elbows fixed."],
  }),
  d({
    id: "skull-crusher", name: "Skull Crusher", equipment: "Barbell",
    primary: ["triceps"], sets: 3, reps: 10,
    steps: [
      "Lie on a flat bench holding a barbell or EZ bar over your chest with a narrow grip.",
      "Keeping your upper arms still, bend your elbows to lower the bar toward your forehead.",
      "Stop just above your head.",
      "Straighten your arms to return to the start.",
    ],
    cues: [
      "Letting your elbows drift slightly back keeps tension on the triceps.",
      "Stay slow and controlled; the name is a warning.",
    ],
  }),
  d({
    id: "overhead-triceps-extension", name: "Overhead Triceps Extension", equipment: "Dumbbell",
    primary: ["triceps"], sets: 3, reps: 12,
    steps: [
      "Sit on a bench with back support, holding one dumbbell overhead with both hands under the top plate.",
      "Keeping your upper arms close to your head, lower the weight behind your head.",
      "Go down until you feel a deep stretch in your triceps.",
      "Straighten your arms to lift it back overhead.",
    ],
    cues: ["Your elbows point forward, not out to the sides."],
  }),
  d({
    id: "close-grip-bench-press", name: "Close-Grip Bench Press", equipment: "Barbell",
    primary: ["triceps", "chest"], secondary: ["shoulders"], sets: 3, reps: 8,
    steps: [
      "Lie on a flat bench and grip the bar about shoulder-width apart.",
      "Unrack and hold it over your chest.",
      "Lower it to your lower chest with your elbows tucked close to your body.",
      "Press back up to straight arms.",
    ],
    cues: ["Hands no closer than shoulder width; narrower strains the wrists."],
  }),
  d({
    id: "triceps-kickback", name: "Triceps Kickback", equipment: "Dumbbell",
    primary: ["triceps"], sets: 3, reps: 12,
    steps: [
      "Put one knee and hand on a bench, holding a dumbbell in the other hand.",
      "Raise your upper arm so it's parallel to your torso, elbow bent to 90°.",
      "Straighten your arm behind you without moving your upper arm.",
      "Squeeze, then bend back to 90°. Finish the set, then switch arms.",
    ],
    cues: ["If your upper arm swings, the weight is too heavy."],
  }),
  d({
    id: "bench-dip", name: "Bench Dip", equipment: "Bench", measure: "bodyweight",
    primary: ["triceps"], secondary: ["chest", "shoulders"], sets: 3, reps: 12,
    steps: [
      "Sit on the edge of a bench with your hands beside your hips, fingers forward.",
      "Slide forward off the bench with your legs out in front, holding yourself up on straight arms.",
      "Bend your elbows to lower your hips until your upper arms are about parallel to the floor.",
      "Push back up to straight arms.",
    ],
    cues: [
      "Keep your back close to the bench.",
      "Bent knees make it easier; feet on a second bench make it harder.",
    ],
  }),

  d({
    id: "diamond-push-up", name: "Diamond Push-Up", equipment: "Bodyweight", measure: "bodyweight",
    aliases: ["close-grip push-up", "triangle push-up"],
    primary: ["triceps"], secondary: ["chest", "shoulders"], sets: 3, reps: 10,
    steps: [
      "Get into a push-up position with your hands close together under your chest.",
      "Lower your chest toward your hands, keeping your elbows close to your sides.",
      "Press back up until your arms are straight.",
    ],
    cues: ["Keep your body in a straight line.", "Drop to your knees if you can't get full reps."],
  }),

  // ---------------- Forearms ----------------
  d({
    id: "reverse-curl", name: "Reverse Curl", equipment: "Dumbbell",
    primary: ["forearms"], secondary: ["biceps"], sets: 3, reps: 12,
    steps: [
      "Stand holding dumbbells or a bar with an overhand grip, palms facing back.",
      "Keep your elbows at your sides and curl the weight up toward your shoulders.",
      "Keep your wrists straight rather than bent back.",
      "Lower slowly.",
    ],
    cues: ["Expect to use noticeably less weight than a normal curl."],
  }),

  // ---------------- Quads ----------------
  d({
    id: "back-squat", name: "Barbell Back Squat", equipment: "Barbell",
    primary: ["quads", "glutes"], secondary: ["hamstrings", "lowerBack", "abs"], sets: 3, reps: 5,
    steps: [
      "Set the bar across your upper back, not your neck, and grip it just outside your shoulders.",
      "Unrack, step back and stand with your feet shoulder-width apart, toes turned out slightly.",
      "Take a big breath, brace, and sit down between your heels, bending hips and knees together.",
      "Go to at least parallel, with your hip crease level with your knees, chest up.",
      "Drive up through your whole foot to stand.",
    ],
    cues: [
      "Knees travel in line with your toes.",
      "Set the rack's safety pins just below your bottom position.",
    ],
  }),
  d({
    id: "front-squat", name: "Front Squat", equipment: "Barbell",
    primary: ["quads"], secondary: ["glutes", "abs", "lowerBack"], sets: 3, reps: 6,
    steps: [
      "Rest the bar on the front of your shoulders with your fingertips under it and elbows high, or cross your arms over it.",
      "Stand with your feet shoulder-width apart.",
      "Squat straight down, keeping your torso upright and elbows up.",
      "Drive back up to standing.",
    ],
    cues: [
      "If your elbows drop, the bar rolls forward.",
      "More upright and quad-focused than a back squat.",
    ],
  }),
  d({
    id: "leg-press", name: "Leg Press", equipment: "Machine",
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Sit with your back flat against the pad and your feet shoulder-width on the platform.",
      "Release the safety handles and lower the platform by bending your knees toward your chest.",
      "Stop before your lower back starts to lift off the pad.",
      "Press back up without slamming your knees straight.",
    ],
    cues: [
      "Feet higher on the platform works more glutes and hamstrings; lower works more quads.",
      "Log the weight on the sled; leave out the sled itself unless you always count it.",
    ],
  }),
  d({
    id: "hack-squat", name: "Hack Squat", equipment: "Machine",
    primary: ["quads"], secondary: ["glutes"], sets: 3, reps: 10,
    steps: [
      "Stand on the platform with your shoulders under the pads and back flat against the backrest.",
      "Set your feet shoulder-width apart and release the safety.",
      "Bend your knees and lower until your thighs are at least parallel to the platform.",
      "Push through your feet to stand back up.",
    ],
    cues: ["Keep your heels down throughout."],
  }),
  d({
    id: "leg-extension", name: "Leg Extension", equipment: "Machine",
    primary: ["quads"], sets: 3, reps: 12,
    steps: [
      "Sit with your back against the pad and your knees lined up with the machine's pivot.",
      "Hook your ankles under the roller pad.",
      "Straighten your legs until they're fully extended.",
      "Squeeze for a second, then lower under control.",
    ],
    cues: ["Don't swing the weight up; slow lowering is where the work is."],
  }),
  d({
    id: "dumbbell-lunge", name: "Dumbbell Lunge", equipment: "Dumbbell",
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Stand holding a dumbbell at each side.",
      "Step forward and lower until both knees are bent about 90°, back knee just above the floor.",
      "Push through your front heel to return to standing.",
      "Alternate legs, or finish one side before switching.",
    ],
    cues: [
      "Keep your torso upright and your front knee over your foot.",
      "Log the reps for one leg.",
    ],
  }),
  d({
    id: "walking-lunge", name: "Walking Lunge", equipment: "Dumbbell",
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Hold a dumbbell at each side and stand tall.",
      "Step forward into a lunge, lowering your back knee toward the floor.",
      "Push off your front foot and bring your back leg straight through into the next lunge.",
      "Keep walking, alternating legs.",
    ],
    cues: [
      "Take steps long enough that your front shin stays roughly vertical.",
      "Log steps per leg, and count the same way every time.",
    ],
  }),
  d({
    id: "step-up", name: "Dumbbell Step-Up", equipment: "Dumbbell",
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Stand facing a sturdy bench or box with a dumbbell in each hand.",
      "Place one whole foot on the bench.",
      "Drive through that heel to stand up onto the bench.",
      "Step down under control. Finish the set, then switch legs.",
    ],
    cues: ["Let the top leg do the work rather than pushing off the bottom foot."],
  }),

  d({
    id: "smith-machine-squat", name: "Smith Machine Squat", equipment: "Machine",
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Set the bar at upper-chest height and step under it so it rests across your upper back.",
      "Place your feet slightly in front of the bar, shoulder width apart, and unhook it.",
      "Sit down and back until your thighs are at least parallel to the floor.",
      "Drive back up through your whole foot and re-hook the bar when you're done.",
    ],
    cues: ["Set the safety stops just below your lowest point.", "Feet a little forward lets you sit back on the fixed bar path."],
  }),
  d({
    id: "goblet-squat", name: "Goblet Squat", equipment: "Dumbbell", image: false,
    aliases: ["kettlebell squat"],
    primary: ["quads", "glutes"], secondary: ["abs"], sets: 3, reps: 10,
    steps: [
      "Hold one dumbbell (or kettlebell) vertically against your chest, both hands under the top end.",
      "Stand with your feet just wider than your shoulders, toes turned out a little.",
      "Squat down between your knees, keeping your chest up and elbows inside your knees.",
      "Stand back up through your whole foot.",
    ],
    cues: ["A great way to learn the squat before loading a barbell."],
  }),
  d({
    id: "bulgarian-split-squat", name: "Bulgarian Split Squat", equipment: "Dumbbell", image: false,
    aliases: ["rear-foot elevated split squat", "rfess"],
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Stand a stride in front of a bench, holding dumbbells at your sides, and rest the top of your back foot on it.",
      "Lower straight down until your back knee nearly touches the floor.",
      "Drive up through your front foot.",
      "Finish the set, then switch legs.",
    ],
    cues: ["Lean forward slightly for more glutes, stay upright for more quads.", "Log reps per leg."],
  }),
  d({
    id: "dumbbell-sumo-squat", name: "Dumbbell Sumo Squat", equipment: "Dumbbell",
    aliases: ["plie squat"],
    primary: ["quads", "glutes"], secondary: ["hamstrings"], sets: 3, reps: 12,
    steps: [
      "Stand with your feet wide and toes turned out, holding one dumbbell by its end between your legs.",
      "Squat straight down, pushing your knees out over your toes.",
      "Go as low as you can with a straight back.",
      "Stand back up, squeezing your glutes at the top.",
    ],
    cues: ["Stand on two plates or steps to let the dumbbell go lower."],
  }),

  // ---------------- Hamstrings ----------------
  d({
    id: "romanian-deadlift", name: "Romanian Deadlift", equipment: "Barbell",
    primary: ["hamstrings", "glutes"], secondary: ["lowerBack", "forearms"], sets: 3, reps: 8,
    steps: [
      "Stand tall holding a barbell at your thighs, hands shoulder-width apart.",
      "With your knees softly bent, push your hips back and slide the bar down your thighs.",
      "Lower until you feel a strong stretch in your hamstrings, usually just below the knees.",
      "Drive your hips forward to stand back up.",
    ],
    cues: [
      "It's a hip hinge, not a squat; your knee bend barely changes.",
      "Keep the bar brushing your legs and your back flat.",
    ],
  }),
  d({
    id: "lying-leg-curl", name: "Lying Leg Curl", equipment: "Machine",
    primary: ["hamstrings"], secondary: ["calves"], sets: 3, reps: 12,
    steps: [
      "Lie face down with the roller just above your heels and your knees just off the end of the bench.",
      "Hold the handles.",
      "Curl your heels toward your glutes as far as you can.",
      "Lower slowly to straight legs.",
    ],
    cues: ["Keep your hips pressed into the pad."],
  }),
  d({
    id: "seated-leg-curl", name: "Seated Leg Curl", equipment: "Machine",
    primary: ["hamstrings"], sets: 3, reps: 12,
    steps: [
      "Sit with your lower legs on the roller and the thigh pad locked over your knees.",
      "Line your knees up with the machine's pivot.",
      "Curl the roller down and back under the seat.",
      "Return slowly until your legs are nearly straight.",
    ],
    cues: ["Leaning your torso forward slightly increases the hamstring stretch."],
  }),

  // ---------------- Glutes ----------------
  d({
    id: "glute-bridge", name: "Glute Bridge", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["glutes"], secondary: ["hamstrings"], sets: 3, reps: 12,
    steps: [
      "Lie on your back with your knees bent and feet flat, hip-width apart.",
      "Brace your core and drive through your heels to lift your hips.",
      "Rise until your body forms a straight line from shoulders to knees.",
      "Squeeze your glutes for a second at the top, then lower.",
    ],
    cues: ["Rest a barbell or plate across your hips and log it as added weight."],
  }),
  d({
    id: "cable-kickback", name: "Cable Glute Kickback", equipment: "Cable",
    primary: ["glutes"], secondary: ["hamstrings"], sets: 3, reps: 12,
    steps: [
      "Fasten an ankle strap from a low pulley around one ankle.",
      "Face the machine, holding it for balance, with a slight hinge at the hips.",
      "Kick the strapped leg straight back, squeezing your glute.",
      "Return slowly. Finish the set, then switch legs.",
    ],
    cues: ["Don't arch your lower back to get extra range."],
  }),
  d({
    id: "hip-abduction", name: "Hip Abduction Machine", equipment: "Machine",
    primary: ["glutes"], sets: 3, reps: 15,
    steps: [
      "Sit in the machine with the pads against the outside of your knees.",
      "Sit tall and hold the handles.",
      "Push your knees out as far as you comfortably can.",
      "Pause, then let them come back together slowly.",
    ],
    cues: ["Leaning forward slightly shifts more of the work to your glutes."],
  }),

  d({
    id: "hip-thrust", name: "Barbell Hip Thrust", equipment: "Barbell", image: false,
    aliases: ["glute bridge barbell"],
    primary: ["glutes"], secondary: ["hamstrings"], sets: 3, reps: 10,
    steps: [
      "Sit on the floor with your upper back against a bench and a padded barbell over your hips.",
      "Plant your feet about hip width apart so your shins are vertical at the top.",
      "Drive through your heels to lift your hips until your body is flat from knees to shoulders.",
      "Squeeze your glutes, then lower under control.",
    ],
    cues: ["Tuck your chin and keep your ribs down; don't arch at the top.", "Use a bar pad or folded mat."],
  }),
  d({
    id: "hip-adduction", name: "Hip Adduction Machine", equipment: "Machine",
    aliases: ["adductor", "inner thigh"],
    primary: ["glutes"], secondary: ["quads"], sets: 3, reps: 15,
    steps: [
      "Sit in the machine with the pads against the inside of your knees.",
      "Squeeze your legs together until the pads meet.",
      "Pause, then let them open slowly.",
    ],
    cues: ["Sit tall and keep your back against the pad."],
  }),

  // ---------------- Calves ----------------
  d({
    id: "standing-calf-raise", name: "Standing Calf Raise", equipment: "Machine",
    primary: ["calves"], sets: 3, reps: 12,
    steps: [
      "Stand with the balls of your feet on the step and your shoulders under the pads.",
      "Let your heels drop below the step for a full stretch.",
      "Rise onto your toes as high as you can.",
      "Pause at the top, then lower slowly.",
    ],
    cues: ["Pause at both ends; bouncing turns it into a tendon exercise."],
  }),
  d({
    id: "seated-calf-raise", name: "Seated Calf Raise", equipment: "Machine",
    primary: ["calves"], sets: 3, reps: 15,
    steps: [
      "Sit with the balls of your feet on the platform and the pad snug on your lower thighs.",
      "Release the safety and lower your heels as far as you can.",
      "Press up onto your toes.",
      "Pause, then lower slowly.",
    ],
    cues: ["With bent knees this works the soleus, the deeper calf muscle."],
  }),

  d({
    id: "leg-press-calf-raise", name: "Leg Press Calf Raise", equipment: "Machine",
    primary: ["calves"], sets: 3, reps: 15,
    steps: [
      "Sit in the leg press and place the balls of your feet on the bottom edge of the platform.",
      "Straighten your legs and release the safety catches.",
      "Let your heels drop back for a full stretch, then push the platform away with your toes.",
      "Keep your knees straight throughout.",
    ],
    cues: ["Keep the safeties within reach in case a foot slips.", "Pause at the stretch."],
  }),

  // ---------------- Abs & obliques ----------------
  d({
    id: "crunch", name: "Crunch", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["abs"], sets: 3, reps: 15,
    steps: [
      "Lie on your back with your knees bent or your legs resting on a bench, hands by your head.",
      "Curl your shoulders off the floor by tightening your abs.",
      "Pause at the top.",
      "Lower slowly.",
    ],
    cues: ["Don't pull on your neck. A small range with a hard squeeze beats a big swing."],
  }),
  d({
    id: "lying-leg-raise", name: "Lying Leg Raise", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["abs"], sets: 3, reps: 12,
    steps: [
      "Lie flat on a bench or the floor, holding the bench behind your head or with your hands under your hips.",
      "Keep your legs straight and together.",
      "Raise them until they point straight up.",
      "Lower slowly until they're just above the floor, without arching your back.",
    ],
    cues: ["Bend your knees to make it easier."],
  }),
  d({
    id: "cable-crunch", name: "Cable Crunch", equipment: "Cable",
    primary: ["abs"], sets: 3, reps: 12,
    steps: [
      "Attach a rope to a high pulley and kneel facing it, holding the rope beside your head.",
      "Keeping your hips still, crunch down to bring your elbows toward your knees.",
      "Round your spine as you go.",
      "Return slowly to upright.",
    ],
    cues: ["The movement comes from your abs, not from sitting your hips back."],
  }),
  d({
    id: "ab-rollout", name: "Ab Rollout", equipment: "Barbell or ab wheel", measure: "bodyweight",
    primary: ["abs"], secondary: ["lowerBack", "shoulders"], sets: 3, reps: 8,
    steps: [
      "Kneel holding a barbell with small round plates, or an ab wheel, on the floor below your shoulders.",
      "Brace your abs and roll forward, letting your hips follow.",
      "Go as far as you can without your lower back sagging.",
      "Pull back to the start using your abs.",
    ],
    cues: ["Shorten the range until you can keep your back flat for every rep."],
  }),
  d({
    id: "bicycle-crunch", name: "Bicycle Crunch", equipment: "Bodyweight", measure: "bodyweight",
    primary: ["abs", "obliques"], sets: 3, reps: 20,
    steps: [
      "Lie on your back with your hands by your head and your knees raised to 90°.",
      "Bring one elbow toward the opposite knee while straightening the other leg.",
      "Switch sides in a pedalling motion.",
      "Keep your lower back pressed into the floor.",
    ],
    cues: ["Slow and controlled beats fast. Count each side as one rep."],
  }),
  d({
    id: "side-plank", name: "Side Plank", equipment: "Bodyweight", measure: "time",
    primary: ["obliques"], secondary: ["abs", "glutes"], sets: 3, reps: 30,
    steps: [
      "Lie on your side with your forearm under your shoulder and your legs stacked.",
      "Lift your hips until your body forms a straight line from head to feet.",
      "Hold, breathing normally.",
      "Lower, then switch sides.",
    ],
    cues: ["Don't let your hips sink. Log seconds per side."],
  }),
  d({
    id: "dumbbell-side-bend", name: "Dumbbell Side Bend", equipment: "Dumbbell",
    primary: ["obliques"], secondary: ["abs"], sets: 3, reps: 12,
    steps: [
      "Stand tall with a dumbbell in one hand and the other hand on your hip.",
      "Bend sideways toward the weight, keeping your hips still.",
      "Use the opposite side of your waist to pull yourself back upright.",
      "Finish the set, then switch sides.",
    ],
    cues: ["Move only side to side, without leaning forward or back."],
  }),

  d({
    id: "plank", name: "Plank", equipment: "Bodyweight", measure: "time", image: false,
    primary: ["abs"], secondary: ["obliques", "shoulders", "glutes"], sets: 3, reps: 45,
    steps: [
      "Rest on your forearms and toes, elbows under your shoulders.",
      "Make a straight line from head to heels by bracing your abs and squeezing your glutes.",
      "Hold, breathing normally.",
    ],
    cues: ["Don't let your hips sag or rise."],
  }),
  d({
    id: "reverse-crunch", name: "Reverse Crunch", equipment: "Bodyweight", measure: "bodyweight",
    aliases: ["hip raise"],
    primary: ["abs"], sets: 3, reps: 15,
    steps: [
      "Lie on your back with your knees bent and your hands by your sides.",
      "Curl your hips off the floor, bringing your knees toward your chest.",
      "Lower slowly until your feet nearly touch the floor.",
    ],
    cues: ["Roll your pelvis up rather than swinging your legs."],
  }),
  d({
    id: "decline-crunch", name: "Decline Crunch", equipment: "Bench", measure: "bodyweight",
    primary: ["abs"], sets: 3, reps: 12,
    steps: [
      "Hook your feet under the pads of a decline bench and lie back.",
      "Cross your arms over your chest or hold a plate.",
      "Curl your shoulders and upper back up toward your knees.",
      "Lower under control without resting at the bottom.",
    ],
    cues: ["Breathe out as you curl up.", "Hold a plate on your chest to add weight."],
  }),
  d({
    id: "hanging-leg-raise", name: "Hanging Leg Raise", equipment: "Pull-up bar", measure: "bodyweight", image: false,
    aliases: ["hanging knee raise"],
    primary: ["abs"], secondary: ["forearms"], sets: 3, reps: 10,
    steps: [
      "Hang from a pull-up bar with straight arms.",
      "Raise your legs in front of you until they're at least level with your hips.",
      "Lower them slowly without swinging.",
    ],
    cues: ["Bend your knees to make it easier.", "Curl your pelvis up at the top for more abs."],
  }),

  // ---------------- Cardio machines ----------------
  c({
    id: "treadmill", aliases: ["cardio", "running", "run", "jogging", "walking", "incline walk"], name: "Treadmill", equipment: "Cardio machine", cardio: ["km", "incline"], minutes: 20,
    primary: ["quads", "calves"], secondary: ["hamstrings", "glutes"],
    steps: [
      "Start the belt at a walk and straddle it until it's moving, then step on.",
      "Build up to your working speed over the first two or three minutes.",
      "Stand tall with relaxed shoulders and land under your hips, not out in front.",
      "Raise the incline for more effort without running faster; 1% makes up for the lack of wind.",
      "Slow to a walk for the last few minutes before stopping.",
    ],
    cues: ["Let go of the rails: holding on cancels out most of the incline.", "Log each block at one speed or incline as its own bout if you like."],
  }),
  c({
    id: "stair-climber", aliases: ["cardio", "stair stepper", "stepper", "stairmaster", "stepmill", "stairs"], name: "Stair Climber", equipment: "Cardio machine", cardio: ["floors", "level"], minutes: 15,
    primary: ["glutes", "quads"], secondary: ["calves", "hamstrings"],
    steps: [
      "Step on while the stairs are stopped, then choose a level.",
      "Climb with your whole foot on each step, pushing through the heel.",
      "Keep your chest up and hands light on the rails, for balance only.",
      "Ease the level down for the last couple of minutes.",
    ],
    cues: ["Leaning on the rails takes your bodyweight off your legs.", "Floors on the display is the easiest number to compare week to week."],
  }),
  c({
    id: "elliptical", aliases: ["cardio", "cross trainer", "cross-trainer"], name: "Elliptical", equipment: "Cardio machine", cardio: ["km", "level"], minutes: 20,
    primary: ["quads", "glutes"], secondary: ["hamstrings", "calves", "chest", "back"],
    steps: [
      "Step onto the pedals holding the fixed handles, then start pedalling.",
      "Set a resistance you can keep a steady rhythm at.",
      "Push and pull the moving handles to bring your upper body in.",
      "Keep your heels down and your knees soft.",
    ],
    cues: ["Pedal backwards now and then to shift the work to your hamstrings and glutes."],
  }),
  c({
    id: "stationary-bike", aliases: ["cardio", "cycling", "bike", "spin bike", "spinning", "exercise bike", "cycle"], name: "Stationary Bike", equipment: "Cardio machine", cardio: ["km", "level"], minutes: 20,
    primary: ["quads"], secondary: ["glutes", "hamstrings", "calves"],
    steps: [
      "Set the seat so your knee is slightly bent at the bottom of the pedal stroke.",
      "Start easy for a few minutes, then raise the resistance to your working level.",
      "Keep your hips still on the seat and push through the ball of the foot.",
      "Finish with a few easy minutes.",
    ],
    cues: ["Save the seat height in your setup note so it's right every time."],
  }),
  c({
    id: "rowing-machine", aliases: ["cardio", "rower", "erg", "rowing"], name: "Rowing Machine", equipment: "Cardio machine", cardio: ["m", "level"], minutes: 10,
    primary: ["back", "quads"], secondary: ["hamstrings", "glutes", "biceps", "shoulders"],
    steps: [
      "Strap your feet in with the strap across the widest part of your foot.",
      "Drive with your legs first, then swing your body back, then pull the handle to your lower ribs.",
      "Return in reverse: arms out, lean forward, then bend your knees.",
      "Set the damper (level) around 3 to 5; higher isn't harder work, just heavier.",
    ],
    cues: ["Legs, body, arms; arms, body, legs.", "Log metres from the monitor."],
  }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const imageFor = (e: Exercise, frame: "a" | "b") => (e.image ? `/ex/${e.id}-${frame}.webp` : null);
