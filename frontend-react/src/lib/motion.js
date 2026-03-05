// Stagger container for parent elements
export const staggerContainer = (staggerMs = 100, delayMs = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: delayMs / 1000,
      staggerChildren: staggerMs / 1000,
    },
  },
})

// Fade up from below
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
}

// Fade in place
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// Scale in
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
}

// Pill item stagger
export const pillItem = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 250,
    },
  },
}

// Waffle cell stagger
export const waffleCell = (index) => ({
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: index * 0.008,
      type: 'spring',
      damping: 20,
      stiffness: 300,
    },
  },
})

// Number count-up spring config
export const countUpSpring = {
  stiffness: 80,
  damping: 20,
  mass: 0.5,
}

// View transition preset
export const viewTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] },
}
