import Section from "./Section"

export default function Experience(){
  return (
    <Section id="experience" headline="Experience & Achievements" sub="Highlights that matter">
      <div className="grid gap-6">
        <div className="card p-6">
          <h3 className="font-semibold">Open Source & GitHub</h3>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-neutral-700 dark:text-neutral-300">
            <li>Pull Shark badge holder</li>
            <li>20+ PRs across 10+ companies/clients</li>
            <li>Active on Devfolio and hackathons</li>
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold">Academics</h3>
          <p>ECE @ IIIT Allahabad — focus on Embedded, Wireless Communication, and VLSI Design.</p>
        </div>
      </div>
    </Section>
  )
}