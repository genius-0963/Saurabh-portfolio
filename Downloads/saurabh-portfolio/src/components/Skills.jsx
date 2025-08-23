import Section from "./Section"
import { skills } from "../data/skills"

function Row({ title, items }){
  return (
    <div className="p-6 card">
      <h4 className="font-semibold mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i)=>(<span key={i} className="badge">{s}</span>))}
      </div>
    </div>
  )
}

export default function Skills(){
  return (
    <Section id="skills" headline="Skills" sub="Tech I use to ship fast with quality">
      <div className="grid md:grid-cols-2 gap-6">
        <Row title="Languages" items={skills.languages} />
        <Row title="Web" items={skills.web} />
        <Row title="Mobile" items={skills.mobile} />
        <Row title="Databases" items={skills.databases} />
        <Row title="Cloud & APIs" items={skills.cloudApis} />
        <Row title="Tools" items={skills.tools} />
        <Row title="AI/ML" items={skills.ai} />
        <Row title="Electronics" items={skills.electronics} />
      </div>
    </Section>
  )
}