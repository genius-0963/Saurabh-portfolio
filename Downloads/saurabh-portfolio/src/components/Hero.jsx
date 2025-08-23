import { motion } from "framer-motion"

export default function Hero(){
  return (
    <section id="home" className="section pt-24 md:pt-32">
      <div className="container text-center">
        <motion.h1
          initial={{opacity:0, y:10}}
          animate={{opacity:1, y:0}}
          transition={{duration:0.8}}
          className="text-4xl md:text-6xl font-extrabold tracking-tight"
        >
          Building AI, Web & Mobile experiences
        </motion.h1>
        <p className="mt-4 text-neutral-700 dark:text-neutral-300 max-w-2xl mx-auto">
          I'm <span className="font-semibold">Saurabh Kumar</span>, an ECE student at <span className="font-semibold">IIIT Allahabad</span>.
          I craft real-time computer vision systems, offline-first mobile apps, and MERN backends.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a href="#projects" className="badge">View Projects</a>
          <a href="#contact" className="badge">Contact Me</a>
        </div>
      </div>
    </section>
  )
}