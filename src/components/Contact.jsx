import Section from "./Section"

export default function Contact(){
  return (
    <Section id="contact" headline="Contact" sub="Let's build something together">
      <div className="card p-6">
        <form className="grid md:grid-cols-2 gap-4">
          <input className="rounded-lg" placeholder="Your name" required/>
          <input className="rounded-lg" placeholder="Email" type="email" required/>
          <textarea className="md:col-span-2 rounded-lg" rows="5" placeholder="Message"></textarea>
          <button className="badge md:col-span-2 w-fit">Send</button>
        </form>
        <div className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
          <p>Email: iec2023016@</p>
          <p>GitHub: github.com/genius-0963</p>
          <p>LinkedIn: add-your-link</p>
        </div>
      </div>
    </Section>
  )
}