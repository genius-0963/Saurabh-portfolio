import Section from "./Section"
import { projects } from "../data/projects"
import ProjectCard from "./ProjectCard"

export default function Projects(){
  return (
    <Section id="projects" headline="Projects" sub="Selected work across AI, Web, and Mobile">
      <div className="grid md:grid-cols-2 gap-6">
        {projects.map((p, i)=>(<ProjectCard key={i} p={p} />))}
      </div>
    </Section>
  )
}