import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import HeroSection from '../components/landing/HeroSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import HowItWorksSection from '../components/landing/HowItWorksSection'
import TestimonialsSection from '../components/landing/TestimonialsSection'
import PricingSection from '../components/landing/PricingSection'
import NewsletterSection from '../components/landing/NewsletterSection'
import FAQSection from '../components/landing/FAQSection'
import CTASection from '../components/landing/CTASection'
import FooterSection from '../components/landing/FooterSection'

export default function Landing({ onNavigate }) {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navbar isLanding={true} onNavigate={onNavigate} isAuthenticated={false} />

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <HeroSection onNavigate={onNavigate} />

        {/* Features Section */}
        <FeaturesSection />

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Pricing Section */}
        <PricingSection />

        {/* Newsletter Section */}
        <NewsletterSection />

        {/* FAQ Section */}
        <FAQSection />

        {/* CTA Section */}
        <CTASection />
      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  )
}
