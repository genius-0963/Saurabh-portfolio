import { motion } from "framer-motion"

export default function Section({ id, headline, sub, children }) {
  return (
    <section id={id} className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{headline}</h2>
          {sub && <p className="text-neutral-600 dark:text-neutral-400 mt-2">{sub}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  )
}