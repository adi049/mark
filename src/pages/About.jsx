import { useSEO } from '@/hooks/useSEO'
import { AboutCraft, AboutIntro, AboutStory, AboutStudio } from '@/sections/about'

/**
 * About. Studio introduction, the founding story, how the team works
 * (before / on the day / after) and the studio's in-house production.
 * All copy is drawn from approved studio facts only.
 */
export default function About() {
  useSEO({
    title: 'About',
    description:
      'Markipie is a photography, cinematography and creative digital services studio with in-house editing, a color lab and print production.',
    path: '/about',
  })

  return (
    <>
      <AboutIntro />
      <AboutStory />
      <AboutCraft />
      <AboutStudio />
    </>
  )
}
