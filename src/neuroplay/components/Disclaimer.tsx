export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'np-disclaimer-compact' : 'np-disclaimer'}>
      <p>
        This application is a cognitive-training research prototype. It is not a medical
        diagnostic tool and does not replace professional medical assessment or treatment.
      </p>
      <p>
        Game performance should not be interpreted as a diagnosis of MCI, dementia,
        Alzheimer&apos;s disease, or another medical condition. Scores are training
        indicators only.
      </p>
    </div>
  );
}
