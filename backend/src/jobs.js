const JOBS = [
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    company: 'Northstar Analytics',
    location: 'Remote',
    type: 'Full-time',
    description: 'Turn business data into clear insights, reports, and recommendations.',
    required_skills: ['Python', 'SQL', 'Excel', 'Power BI', 'Data Analysis', 'Data Visualization'],
  },
  {
    id: 'frontend-developer',
    title: 'Frontend Developer',
    company: 'Brightside Labs',
    location: 'Hybrid',
    type: 'Full-time',
    description: 'Build accessible, responsive product experiences with a modern web stack.',
    required_skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git', 'Team Collaboration'],
  },
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    company: 'Orbit Systems',
    location: 'Remote',
    type: 'Full-time',
    description: 'Design, build, and maintain reliable software alongside a collaborative team.',
    required_skills: ['Python', 'Java', 'SQL', 'Git', 'Problem Solving', 'Team Collaboration'],
  },
  {
    id: 'machine-learning-engineer',
    title: 'Machine Learning Engineer',
    company: 'Signal AI',
    location: 'Remote',
    type: 'Full-time',
    description: 'Develop and evaluate machine-learning systems for real-world products.',
    required_skills: ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'SQL'],
  },
  {
    id: 'business-analyst',
    title: 'Business Analyst',
    company: 'Cedar Consulting',
    location: 'Hybrid',
    type: 'Full-time',
    description: 'Connect stakeholders, processes, and data to improve business outcomes.',
    required_skills: ['Excel', 'Jira', 'Agile', 'SQL', 'Stakeholder Management', 'Project Planning'],
  },
  {
    id: 'project-coordinator',
    title: 'Project Coordinator',
    company: 'Waypoint Group',
    location: 'On-site',
    type: 'Full-time',
    description: 'Keep cross-functional projects organized, transparent, and on schedule.',
    required_skills: ['Jira', 'Agile', 'Project Planning', 'Stakeholder Management', 'Team Collaboration'],
  },
]

const LEARNING_RESOURCES = {
  Agile: 'Learn the fundamentals of agile delivery and sprint planning.',
  CSS: 'Practice responsive layouts, Flexbox, and CSS Grid.',
  'Data Analysis': 'Explore data cleaning, exploratory analysis, and interpretation.',
  'Data Visualization': 'Learn to choose clear charts and build data stories.',
  'Deep Learning': 'Study neural networks, training, and model evaluation.',
  Excel: 'Practice formulas, pivot tables, and data cleanup.',
  Git: 'Learn branching, commits, and collaborative version control.',
  HTML: 'Build semantic, accessible page structures.',
  Java: 'Practice object-oriented programming and core Java APIs.',
  JavaScript: 'Learn modern JavaScript, asynchronous code, and browser APIs.',
  Jira: 'Practice issue tracking, boards, and project workflows.',
  'Machine Learning': 'Study supervised learning, feature engineering, and evaluation.',
  'Power BI': 'Build a dashboard from a cleaned sample dataset.',
  Python: 'Practice Python fundamentals, data structures, and small projects.',
  React: 'Build component-based interfaces and manage application state.',
  SQL: 'Practice joins, aggregation, and querying relational data.',
  'Stakeholder Management': 'Practice stakeholder mapping and clear status updates.',
  TensorFlow: 'Build and evaluate a small TensorFlow model.',
  'Team Collaboration': 'Practice code reviews, pair work, and shared planning.',
  'Problem Solving': 'Work through structured problem-solving exercises.',
  'Project Planning': 'Practice breaking work into milestones and estimating effort.',
}

const AVAILABLE_SKILLS = [...new Set(JOBS.flatMap((job) => job.required_skills))]

function matchJobs(candidateSkills = []) {
  const skills = new Set(candidateSkills.map((skill) => skill.toLowerCase()))

  return JOBS.map((job) => {
    const matched_skills = job.required_skills.filter((skill) => skills.has(skill.toLowerCase()))
    const missing_skills = job.required_skills.filter((skill) => !skills.has(skill.toLowerCase()))

    return {
      ...job,
      match_percentage: Math.round((matched_skills.length / job.required_skills.length) * 100),
      matched_skills,
      missing_skills,
    }
  }).sort((left, right) => right.match_percentage - left.match_percentage || left.title.localeCompare(right.title))
}

function createRoadmap(job, completedSkills = []) {
  const completed = new Set(completedSkills.map((skill) => skill.toLowerCase()))

  return job.missing_skills.map((skill, index) => ({
    skill,
    title: LEARNING_RESOURCES[skill] || `Build practical skills in ${skill}.`,
    priority: index < 3 ? 'High' : 'Medium',
    completed: completed.has(skill.toLowerCase()),
  }))
}

module.exports = { AVAILABLE_SKILLS, JOBS, createRoadmap, matchJobs }
