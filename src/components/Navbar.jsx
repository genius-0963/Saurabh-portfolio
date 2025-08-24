import { useEffect, useState } from "react"

export default function Navbar(){
  const [dark, setDark] = useState(true)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 dark:bg-neutral-950/70 border-b border-neutral-200/60 dark:border-neutral-800">
      <div className="container flex items-center justify-between py-4">
        <a href="#" className="font-semibold">Saurabh Kumar</a>
        <nav className="hidden md:flex gap-6 text-sm">
          {["home","about","skills","projects","experience","contact"].map(x => (
            <a key={x} href={`#${x}`} className="hover:opacity-75">{x.title()}</a>
          ))}
        </nav>
        <button className="badge" onClick={()=>setDark(v=>!v)}>{dark ? "Dark" : "Light"} mode</button>
      </div>
    </header>
  )
}