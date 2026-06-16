import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { storage } from '../lib/storage';
import { Button } from '../components/ui';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    city: '',
    revenueRange: 'Under ₹50K',
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerName.trim()) return;
    storage.setRestaurant(form);
    navigate('/upload');
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#4ADE80]/10 mb-4">
            <ChefHat size={32} className="text-[#4ADE80]" />
          </div>
          <h1 className="text-white text-3xl font-bold">BusinessIQ</h1>
          <p className="text-gray-400 mt-2">Your AI-powered business analyst</p>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5">Set up your restaurant</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Restaurant Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Shyam Dhaba"
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4ADE80]"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Owner Name *</label>
              <input
                type="text"
                value={form.ownerName}
                onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                placeholder="e.g. Shashank"
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4ADE80]"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Bangalore"
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4ADE80]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Monthly Revenue Range</label>
              <select
                value={form.revenueRange}
                onChange={e => setForm(f => ({ ...f, revenueRange: e.target.value }))}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4ADE80]"
              >
                <option>Under ₹50K</option>
                <option>₹50K–₹1L</option>
                <option>₹1L–₹5L</option>
                <option>Above ₹5L</option>
              </select>
            </div>
            <Button type="submit" size="lg" className="w-full justify-center mt-2">
              Get Started →
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
