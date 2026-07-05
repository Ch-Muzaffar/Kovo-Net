import React, { useState } from 'react';
import { useUI, useNavigation } from '../../context/AppContext';
import Icon from '../../components/Icon';
import { submitFeedback } from '../../api/feedback.js';

export default function FeedbackView() {
  const { showToast } = useUI();
  const { navigate } = useNavigation();

  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    category: 'general_review',
    message: '',
    isAnonymous: false
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackForm.message.trim()) {
      showToast('Please enter your feedback description.', 'error');
      return;
    }
    setSubmittingFeedback(true);
    try {
      await submitFeedback({
        rating: feedbackForm.rating,
        category: feedbackForm.category,
        message: feedbackForm.message,
        is_anonymous: feedbackForm.isAnonymous
      });
      showToast('Thank you! Your feedback has been submitted successfully.', 'success');
      setFeedbackForm({
        rating: 5,
        category: 'general_review',
        message: '',
        isAnonymous: false
      });
      navigate('feed');
    } catch (err) {
      showToast(err.message || 'Failed to submit feedback.', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="page-enter">
      <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-1 flex items-center gap-2">
        <Icon icon="solar:chat-square-like-bold-duotone" style={{ color: 'var(--accent-purple)' }} />
        Share Your Feedback
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Help us make KOVO NET better. Report problems, suggest features, or write a general review.</p>

      <form onSubmit={handleFeedbackSubmit} className="card p-6 space-y-6">
        {/* Category selector */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2.5">Category</label>
          <div className="flex flex-wrap gap-2.5">
            {[
              { id: 'general_review', label: 'General Review', icon: 'solar:chat-square-check-bold-duotone' },
              { id: 'bug_report', label: 'Bug Report', icon: 'solar:bug-bold-duotone' },
              { id: 'feature_request', label: 'Feature Request', icon: 'solar:magic-stick-bold-duotone' },
              { id: 'academic_issue', label: 'Academic/Department Issue', icon: 'solar:letter-opened-bold-duotone' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-300"
                style={{
                  background: feedbackForm.category === cat.id ? 'var(--gradient-btn)' : 'var(--bg-glass-input)',
                  borderColor: feedbackForm.category === cat.id ? 'transparent' : 'var(--border-color)',
                  color: feedbackForm.category === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: feedbackForm.category === cat.id ? '0 8px 24px rgba(139, 92, 246, 0.25)' : 'none',
                }}
                onClick={() => setFeedbackForm({ ...feedbackForm, category: cat.id })}
              >
                <Icon icon={cat.icon} style={{ fontSize: '1rem', color: feedbackForm.category === cat.id ? '#ffffff' : 'var(--accent-purple)' }} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rating stars */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Rating</label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
                onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
              >
                <Icon
                  icon="solar:star-bold-duotone"
                  style={{
                    fontSize: '2rem',
                    color: star <= feedbackForm.rating ? '#FBBF24' : 'var(--text-muted)',
                    transition: 'color 0.2s ease',
                    filter: star <= feedbackForm.rating ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' : 'none'
                  }}
                />
              </button>
            ))}
            <span className="text-xs text-[var(--text-muted)] ml-2">
              {feedbackForm.rating === 5 && 'Excellent! ❤️'}
              {feedbackForm.rating === 4 && 'Very Good! 😊'}
              {feedbackForm.rating === 3 && 'Good/Average 😐'}
              {feedbackForm.rating === 2 && 'Needs Work 🙁'}
              {feedbackForm.rating === 1 && 'Poor/Broken 😡'}
            </span>
          </div>
        </div>

        {/* Description message */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">Your Message</label>
          <textarea
            className="input-field"
            rows="5"
            placeholder="Tell us what's on your mind. Be as specific as possible..."
            value={feedbackForm.message}
            onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
            style={{ resize: 'none' }}
            required
          />
        </div>

        {/* Anonymous Toggle */}
        <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-5">
          <div>
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Submit Anonymously</span>
            <span className="text-xs text-[var(--text-muted)]">Hide your user name and profile info from moderators.</span>
          </div>
          <button
            type="button"
            className={`toggle-track ${feedbackForm.isAnonymous ? 'active' : ''}`}
            onClick={() => setFeedbackForm({ ...feedbackForm, isAnonymous: !feedbackForm.isAnonymous })}
            role="switch"
            aria-checked={feedbackForm.isAnonymous}
          >
            <div className="toggle-thumb" />
          </button>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="btn-glass-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            disabled={submittingFeedback}
          >
            {submittingFeedback ? (
              <>
                <div className="spinner-sm" style={{ width: '0.9rem', height: '0.9rem' }} />
                Submitting Feedback...
              </>
            ) : (
              <>
                <Icon icon="solar:chat-square-send-bold-duotone" style={{ fontSize: '1.2rem' }} />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
