export default function Footer(){
  return (
    <footer className="py-10 text-center text-sm text-neutral-600 dark:text-neutral-400">
      © {new Date().getFullYear()} Saurabh Kumar • Built with React + Tailwind
    </footer>
  )
}