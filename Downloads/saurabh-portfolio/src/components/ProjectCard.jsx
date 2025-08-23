export default function ProjectCard({ p }){
  return (
    <div className="card p-6 flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold">{p.title}</h3>
        <span className="badge">{p.period}</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{p.subtitle}</p>
      <p className="mt-3">{p.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {p.tech.map((t, i)=>(<span key={i} className="badge">{t}</span>))}
      </div>
      <div className="mt-4 flex gap-3">
        {p.links?.demo && <a className="link" href={p.links.demo} target="_blank">Live</a>}
        {p.links?.github && <a className="link" href={p.links.github} target="_blank">Code</a>}
      </div>
    </div>
  )
}