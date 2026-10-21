import React from 'react';
import { Brain, ShieldCheck, Activity, Layers, Zap, MonitorSmartphone } from 'lucide-react';

interface ScienceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScienceModal: React.FC<ScienceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-10 space-y-8 rounded-3xl border border-slate-700/60 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Brain size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                Computerised Cognitive Therapy (CCT)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Scientific Foundations, Neuroplasticity &amp; Unsupervised Interventions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Cognitive Reserve & Neuroplasticity */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <Activity size={16} /> 1. Cognitive Reserve &amp; Neuroplasticity
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Cognitive intervention may support cognitive function for some people with mild cognitive impairment. One proposed mechanism is increased <em>cognitive reserve</em>: the brain&apos;s ability to remain resilient when faced with age-related or disease-related change. Research in older adults has also reported training-associated changes in brain activity, blood flow, connectivity, and white-matter measures. These findings describe possible mechanisms; they do not make any one game a treatment or diagnosis.
          </p>
        </div>

        {/* Section 2: Conventional cognitive-support approaches */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <Brain size={16} /> 2. Cognitive Support Has Multiple Components
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cognitive health is commonly supported through a combination of clinical care and lifestyle approaches. Computerised training is one possible component, alongside professional advice on medication, nutrition, physical activity, social participation, continued learning, memory strategies, dance or other movement activities, and—in selected clinical settings—non-invasive brain stimulation.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300">
            {['Exercise', 'Nutrition', 'Social activity', 'Continued learning', 'Memory training', 'Movement and dance'].map((item) => (
              <div key={item} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-center">
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Hardware vs Software Paradigm */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Layers size={14} /> The &quot;Hardware vs. Software&quot; Paradigm
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            While physical exercise serves as the biological <strong>&quot;hardware&quot;</strong> (preserving gray matter volume and vascular integrity), targeted computerized cognitive exercises act as the <strong>&quot;software&quot;</strong>, strengthening the efficiency, speed, and plasticity of neural circuits through repeated structured activation.
          </p>
        </div>

        {/* Section 4: Why computerised training */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <MonitorSmartphone size={16} /> 3. Why Computerised Cognitive Training
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Digital tasks can make training easier to access than paper-and-pencil exercises. They can present repeatable exercises, capture reaction time and accuracy automatically, provide immediate feedback, and adjust task difficulty to the participant&apos;s recent performance. These capabilities support consistent practice and personalised pacing.
          </p>
        </div>

        {/* Section 5: Supervised vs. Unsupervised CCT */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <Zap size={16} /> 4. Supervised vs. Unsupervised CCT
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-200 block">Supervised CCT</span>
              <p className="text-slate-400 leading-relaxed">
                Conducted in scheduled clinical slots under direct supervision of occupational therapists or neuropsychologists. Effective but constrained by availability and travel.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 space-y-1.5">
              <span className="font-bold text-teal-300 block">Unsupervised CCT</span>
              <p className="text-slate-300 leading-relaxed">
                Self-administered at home or in community settings without real-time professional supervision. A platform can use performance feedback to offer personalised pacing, but it does not replace clinical assessment or treatment.
              </p>
            </div>
          </div>
        </div>

        {/* Section 6: Domains supported by the game suite */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <Zap size={16} /> 5. Training Domains in NeuroPlay
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The game suite presents practice tasks across verbal, visual, and episodic memory, as well as attention, working memory, processing speed, cognitive flexibility, and executive function. Session scores are training indicators, not measures of disease or diagnosis.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Verbal memory', 'Visual memory', 'Episodic memory', 'Attention', 'Working memory', 'Processing speed', 'Cognitive flexibility'].map((domain) => (
              <span key={domain} className="px-2.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-200">
                {domain}
              </span>
            ))}
          </div>
        </div>

        {/* Section 7: Clinical Accommodations for Older Adults */}
        <div className="space-y-3">
          <h3 className="text-sm uppercase tracking-wider font-bold text-teal-400 flex items-center gap-2">
            <ShieldCheck size={16} /> 6. Accessibility and Safe Pacing
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Following evidence-based adaptations (Evans, 2007; Laidlaw et al.), this platform incorporates:
          </p>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-300">
            <li className="flex items-center gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-teal-400">•</span> Multimodal Visual &amp; Spatial presentation
            </li>
            <li className="flex items-center gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-teal-400">•</span> High contrast &amp; glare-reducing Clarity Mode
            </li>
            <li className="flex items-center gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-teal-400">•</span> Dynamic fatigue detection &amp; rest pacing
            </li>
            <li className="flex items-center gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-teal-400">•</span> Isolated multi-player tracking &amp; history
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            This is a cognitive-training research prototype. It is not a medical device, clinical diagnosis, or substitute for advice from a qualified healthcare professional.
          </p>
          <button
            onClick={onClose}
            className="np-btn-primary py-2.5 px-6 text-xs font-semibold float-right"
          >
            Understood
          </button>
          <div className="clear-both" />
        </div>
      </div>
    </div>
  );
};
