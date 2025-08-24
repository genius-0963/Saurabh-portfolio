import Section from "./Section"

export default function About(){
  return (
    <Section id="about" headline="About Me" sub="ECE @ IIIT Allahabad • AI • MERN • React Native">
      <div className="card p-6 md:p-10 leading-relaxed text-neutral-800 dark:text-neutral-200">
        <p>
          Passionate about building production-ready apps with clean UX. I love shipping AI features
          like object detection and speech separation, and engineering offline-first mobile experiences.
        </p>
        <p className="mt-4">
          I contribute on GitHub (Pull Shark, 20+ PRs) and collaborate with startups & labs.
        </p>
      </div>
    </Section>
  )
}