"""
LinkedIn Post Performance Predictor

Predicts engagement metrics for LinkedIn posts using:
1. A synthetic dataset grounded in published benchmark research
2. A trained HistGradientBoosting model for metric prediction
3. A heuristic quality scorer for actionable suggestions

Data sources for benchmarks:
- Social Insider LinkedIn Benchmarks 2025
- Hootsuite/Buffer/Sprout Social best-time studies
- Usera & Durham (2025) "What Predicts Engagement on LinkedIn?"
- ConnectSafely ideal post length guide 2026
- ClosleyHQ hashtag analysis (10,000 posts)
- Trust Insights Unofficial LinkedIn Algorithm Guide mid-2025
"""

import re
import math
import random
import numpy as np
import textstat
from typing import Optional
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor

# ─── Constants from published research ──────────────────────────────

# Engagement rate by post format (Social Insider 2025, ContentIn 2026)
FORMAT_ENGAGEMENT = {
    "text": 0.012,       # 0.5-2%
    "image": 0.035,      # 2-5%
    "video": 0.056,      # 5.6%
    "document": 0.058,   # 5.85% (carousel/PDF)
    "poll": 0.065,       # ~2x avg reach, high engagement
    "article": 0.020,    # long-form, lower engagement
}

# Reach multiplier: what fraction of followers see the post
FORMAT_REACH = {
    "text": 0.08,
    "image": 0.12,
    "video": 0.15,
    "document": 0.18,
    "poll": 0.22,
    "article": 0.06,
}

# Industry baseline engagement rates (ClosleyHQ, Sprout Social 2025)
INDUSTRY_ENGAGEMENT = {
    "e-commerce": 0.039,
    "technology": 0.036,
    "healthcare": 0.033,
    "finance": 0.032,
    "education": 0.035,
    "b2b": 0.036,
    "legal": 0.030,
    "real-estate": 0.032,
    "automotive": 0.031,
    "travel": 0.034,
    "": 0.034,  # default
}

# Day-of-week multiplier (Hootsuite, Buffer, Sprout 2025)
DAY_MULTIPLIER = {
    0: 0.95,   # Monday
    1: 1.20,   # Tuesday (best)
    2: 1.15,   # Wednesday
    3: 1.10,   # Thursday
    4: 0.85,   # Friday
    5: 0.55,   # Saturday
    6: 0.50,   # Sunday
}

# Hour multiplier (8AM-noon peak)
def hour_multiplier(hour: int) -> float:
    if 8 <= hour <= 11:
        return 1.20
    elif 6 <= hour <= 7 or 12 <= hour <= 14:
        return 1.05
    elif 15 <= hour <= 17:
        return 0.90
    elif 18 <= hour <= 20:
        return 0.80
    else:
        return 0.65

# Follower-count based engagement rate adjustment
def follower_engagement_factor(followers: int) -> float:
    """Smaller accounts get higher % engagement, larger get lower."""
    if followers < 1000:
        return 1.4
    elif followers < 5000:
        return 1.2
    elif followers < 10000:
        return 1.0
    elif followers < 50000:
        return 0.75
    elif followers < 100000:
        return 0.55
    else:
        return 0.40

# ─── Feature Extraction ────────────────────────────────────────────

def extract_features(text: str, post_type: str = "text", follower_count: int = 5000,
                     day_of_week: int = 2, hour_of_day: int = 9, industry: str = "",
                     hashtags: list = None) -> dict:
    """Extract all scoring features from post content."""
    if not text:
        text = ""

    char_count = len(text)
    word_count = len(text.split())
    hashtag_list = hashtags or re.findall(r'#\w+', text)
    num_hashtags = len(hashtag_list)
    num_mentions = len(re.findall(r'@\w+', text))
    num_questions = text.count('?')
    num_emojis = len(re.findall(r'[\U0001F600-\U0001F9FF\U00002702-\U000027B0\U0001FA00-\U0001FAFF]', text))
    has_url = 1 if re.search(r'https?://\S+|www\.\S+', text) else 0
    num_line_breaks = text.count('\n')

    # Readability
    try:
        flesch_grade = textstat.flesch_kincaid_grade(text) if word_count > 10 else 8.0
        flesch_ease = textstat.flesch_reading_ease(text) if word_count > 10 else 60.0
    except:
        flesch_grade = 8.0
        flesch_ease = 60.0

    # Sentiment via simple heuristic (we'll use the pipeline's VADER if available)
    positive_words = len(re.findall(
        r'\b(great|amazing|excited|love|proud|thrilled|incredible|fantastic|happy|grateful|'
        r'success|achieve|grow|learn|opportunity|inspire|powerful|breakthrough|transform)\b',
        text.lower()
    ))
    negative_words = len(re.findall(
        r'\b(fail|hate|terrible|awful|worst|frustrated|angry|disappointed|struggle|problem|'
        r'mistake|wrong|bad|crisis|unfortunately)\b',
        text.lower()
    ))
    sentiment = min(1.0, max(-1.0, (positive_words - negative_words) / max(1, word_count) * 10))

    # Hook analysis (first 140 chars)
    hook = text[:140] if text else ""
    hook_has_question = 1 if '?' in hook else 0
    hook_has_number = 1 if re.search(r'\d+', hook) else 0
    hook_has_colon = 1 if ':' in hook else 0

    # CTA detection
    cta_patterns = r'\b(comment|share|repost|follow|subscribe|click|check out|read more|link in|'
    cta_patterns += r'let me know|what do you think|agree|disagree|tag someone|dm me|download)\b'
    has_cta = 1 if re.search(cta_patterns, text.lower()) else 0

    # Storytelling detection (has beginning/middle/end structure markers)
    story_markers = len(re.findall(
        r'\b(here\'s what happened|i learned|the result|lesson|takeaway|then|'
        r'but then|turns out|here\'s the thing|moral of the story|in the end)\b',
        text.lower()
    ))
    has_storytelling = 1 if story_markers >= 2 else 0

    # List/framework detection
    has_list = 1 if re.search(r'(?:^|\n)\s*[\d•\-→✅❌▸►]\s', text) else 0

    # Formatting score (line breaks create whitespace = more readable)
    formatting_score = min(1.0, num_line_breaks / max(1, word_count / 20))

    # Post type encoding
    type_idx = {"text": 0, "image": 1, "video": 2, "document": 3, "poll": 4, "article": 5}

    return {
        "char_count": char_count,
        "word_count": word_count,
        "num_hashtags": num_hashtags,
        "num_mentions": num_mentions,
        "num_questions": num_questions,
        "num_emojis": num_emojis,
        "has_url": has_url,
        "num_line_breaks": num_line_breaks,
        "flesch_grade": flesch_grade,
        "flesch_ease": flesch_ease,
        "sentiment": sentiment,
        "hook_has_question": hook_has_question,
        "hook_has_number": hook_has_number,
        "hook_has_colon": hook_has_colon,
        "has_cta": has_cta,
        "has_storytelling": has_storytelling,
        "has_list": has_list,
        "formatting_score": formatting_score,
        "post_type_idx": type_idx.get(post_type, 0),
        "follower_count": follower_count,
        "day_of_week": day_of_week,
        "hour_of_day": hour_of_day,
        "day_mult": DAY_MULTIPLIER.get(day_of_week, 1.0),
        "hour_mult": hour_multiplier(hour_of_day),
        "follower_factor": follower_engagement_factor(follower_count),
        "format_eng_rate": FORMAT_ENGAGEMENT.get(post_type, 0.03),
        "format_reach": FORMAT_REACH.get(post_type, 0.10),
        "industry_eng_rate": INDUSTRY_ENGAGEMENT.get(industry, 0.034),
    }


def features_to_array(f: dict) -> np.ndarray:
    """Convert feature dict to numpy array for model input."""
    return np.array([
        f["char_count"], f["word_count"], f["num_hashtags"], f["num_mentions"],
        f["num_questions"], f["num_emojis"], f["has_url"], f["num_line_breaks"],
        f["flesch_grade"], f["flesch_ease"], f["sentiment"],
        f["hook_has_question"], f["hook_has_number"], f["hook_has_colon"],
        f["has_cta"], f["has_storytelling"], f["has_list"], f["formatting_score"],
        f["post_type_idx"], f["follower_count"], f["day_of_week"], f["hour_of_day"],
    ], dtype=np.float64).reshape(1, -1)


# ─── Synthetic Dataset Generation ──────────────────────────────────

def _generate_synthetic_dataset(n=5000, seed=42):
    """
    Generate synthetic LinkedIn posts with engagement metrics grounded in
    published benchmark data. Each row has features → engagement outcomes.
    """
    rng = random.Random(seed)
    np_rng = np.random.RandomState(seed)

    post_types = ["text", "image", "video", "document", "poll", "article"]
    industries = list(INDUSTRY_ENGAGEMENT.keys())

    X_rows = []
    y_rows = []  # [impressions, reactions, comments, shares]

    for _ in range(n):
        # Random post configuration
        ptype = rng.choice(post_types)
        industry = rng.choice(industries)
        followers = int(10 ** np_rng.uniform(2.5, 5.5))  # 300 to 300k
        day = rng.randint(0, 6)
        hour = rng.randint(6, 22)

        # Content features (realistic distributions)
        char_count = int(np_rng.normal(1200, 600))
        char_count = max(50, min(3000, char_count))
        word_count = char_count // 6
        num_hashtags = rng.choices([0, 1, 2, 3, 4, 5, 7, 10], weights=[15, 25, 25, 15, 8, 5, 4, 3])[0]
        num_mentions = rng.choices([0, 1, 2, 3, 5], weights=[50, 25, 15, 7, 3])[0]
        num_questions = rng.choices([0, 1, 2, 3], weights=[40, 35, 18, 7])[0]
        num_emojis = rng.choices([0, 1, 2, 3, 5, 8], weights=[30, 25, 20, 12, 8, 5])[0]
        has_url = rng.choices([0, 1], weights=[65, 35])[0]
        num_line_breaks = int(np_rng.normal(8, 5))
        num_line_breaks = max(0, min(30, num_line_breaks))
        flesch_grade = np_rng.normal(9, 3)
        flesch_grade = max(2, min(20, flesch_grade))
        flesch_ease = max(10, min(100, 100 - flesch_grade * 5 + np_rng.normal(0, 10)))
        sentiment = np_rng.normal(0.2, 0.3)
        sentiment = max(-1, min(1, sentiment))
        hook_has_question = rng.choices([0, 1], weights=[60, 40])[0]
        hook_has_number = rng.choices([0, 1], weights=[55, 45])[0]
        hook_has_colon = rng.choices([0, 1], weights=[65, 35])[0]
        has_cta = rng.choices([0, 1], weights=[45, 55])[0]
        has_storytelling = rng.choices([0, 1], weights=[70, 30])[0]
        has_list = rng.choices([0, 1], weights=[60, 40])[0]
        formatting_score = np_rng.uniform(0, 1)

        type_idx = {"text": 0, "image": 1, "video": 2, "document": 3, "poll": 4, "article": 5}[ptype]

        X_rows.append([
            char_count, word_count, num_hashtags, num_mentions,
            num_questions, num_emojis, has_url, num_line_breaks,
            flesch_grade, flesch_ease, sentiment,
            hook_has_question, hook_has_number, hook_has_colon,
            has_cta, has_storytelling, has_list, formatting_score,
            type_idx, followers, day, hour,
        ])

        # ── Compute engagement using benchmark-grounded multipliers ──

        # Base engagement rate (format × industry)
        base_eng = FORMAT_ENGAGEMENT[ptype]
        industry_eng = INDUSTRY_ENGAGEMENT.get(industry, 0.034)
        eng_rate = (base_eng * 0.6 + industry_eng * 0.4)

        # Content quality multipliers (from research)
        # Post length: 1300-1900 chars = +47%
        if 1300 <= char_count <= 1900:
            eng_rate *= 1.47
        elif 800 <= char_count <= 2100:
            eng_rate *= 1.15
        elif char_count < 300:
            eng_rate *= 0.65

        # Hashtags: 1-3 = +12.6%, 5+ = penalty
        if 1 <= num_hashtags <= 3:
            eng_rate *= 1.126
        elif num_hashtags > 5:
            eng_rate *= 0.85

        # Mentions: +30%
        if num_mentions >= 1:
            eng_rate *= 1.0 + min(0.3, num_mentions * 0.1)

        # Storytelling: +83%
        if has_storytelling:
            eng_rate *= 1.83

        # CTA: +20%
        if has_cta:
            eng_rate *= 1.20

        # Emojis: 1-3 = +25%
        if 1 <= num_emojis <= 3:
            eng_rate *= 1.25
        elif num_emojis > 5:
            eng_rate *= 0.90

        # External link: -30% reach
        if has_url:
            eng_rate *= 0.70

        # Hook quality
        hook_bonus = 1.0
        if hook_has_question:
            hook_bonus += 0.15
        if hook_has_number:
            hook_bonus += 0.10
        eng_rate *= hook_bonus

        # Readability: grade 6-10 optimal
        if 6 <= flesch_grade <= 10:
            eng_rate *= 1.10
        elif flesch_grade > 14:
            eng_rate *= 0.80

        # Formatting/whitespace
        eng_rate *= (1.0 + formatting_score * 0.15)

        # List posts tend to do well
        if has_list:
            eng_rate *= 1.12

        # Sentiment: slightly positive optimal
        if 0.1 <= sentiment <= 0.5:
            eng_rate *= 1.10
        elif sentiment < -0.3:
            eng_rate *= 0.85

        # Temporal multipliers
        eng_rate *= DAY_MULTIPLIER.get(day, 1.0)
        eng_rate *= hour_multiplier(hour)

        # Follower-based scaling
        follower_factor = follower_engagement_factor(followers)
        eng_rate *= follower_factor

        # Reach (impressions)
        reach_rate = FORMAT_REACH[ptype]
        if has_url:
            reach_rate *= 0.70
        reach_rate *= DAY_MULTIPLIER.get(day, 1.0) * hour_multiplier(hour)

        impressions = int(followers * reach_rate * np_rng.lognormal(0, 0.3))
        impressions = max(10, impressions)

        # Engagement counts from rate
        total_engagements = int(impressions * eng_rate)

        # Split into reactions (60%), comments (25%), shares (15%)
        reactions = int(total_engagements * np_rng.uniform(0.50, 0.70))
        comments = int(total_engagements * np_rng.uniform(0.15, 0.30))
        shares = max(0, total_engagements - reactions - comments)

        # Add noise
        noise = lambda x: max(0, int(x * np_rng.lognormal(0, 0.25)))
        impressions = noise(impressions)
        reactions = noise(reactions)
        comments = noise(comments)
        shares = noise(shares)

        y_rows.append([impressions, reactions, comments, shares])

    return np.array(X_rows, dtype=np.float64), np.array(y_rows, dtype=np.float64)


# ─── Model Training ────────────────────────────────────────────────

_model = None

def _get_model():
    global _model
    if _model is not None:
        return _model

    print("  [LinkedIn] Generating synthetic training data (5000 posts)...")
    X, y = _generate_synthetic_dataset(n=5000)

    # Log-transform targets for better regression
    y_log = np.log1p(y)

    print("  [LinkedIn] Training HistGradientBoosting model...")
    _model = MultiOutputRegressor(
        HistGradientBoostingRegressor(
            max_iter=200, max_depth=6, learning_rate=0.1, random_state=42
        )
    )
    _model.fit(X, y_log)
    print("  [LinkedIn] Model ready.")
    return _model


# ─── Quality Score ─────────────────────────────────────────────────

def compute_quality_score(features: dict, pipeline_enrichment: dict = None) -> tuple:
    """
    Compute a 0-100 quality score with breakdown and suggestions.
    Based on published LinkedIn engagement research.

    When pipeline_enrichment is provided, additional signals from the Polaris
    pipeline (RoBERTa sentiment, trend momentum, cultural context, audience
    alignment, visual quality) are woven into the score as a dedicated factor.
    """
    if pipeline_enrichment is None:
        pipeline_enrichment = {}

    scores = {}
    suggestions = []
    max_points = {}

    # Post length (15 points)
    max_points["post_length"] = 15
    cc = features["char_count"]
    if 1300 <= cc <= 1900:
        scores["post_length"] = 15
    elif 800 <= cc <= 2100:
        scores["post_length"] = 10
    elif 500 <= cc <= 2500:
        scores["post_length"] = 6
    else:
        scores["post_length"] = 2
        if cc < 500:
            suggestions.append(f"Your post is {cc} characters. Posts between 1,300-1,900 characters get 47% higher engagement on LinkedIn.")
        else:
            suggestions.append(f"Your post is {cc} characters — consider trimming to 1,300-1,900 for optimal engagement.")

    # Hook quality (20 points)
    max_points["hook"] = 20
    hook_score = 5  # base
    if features["hook_has_question"]:
        hook_score += 6
    else:
        suggestions.append("Your opening line doesn't ask a question. Questions in the first line reduce the 60-70% drop-off at 'See more'.")
    if features["hook_has_number"]:
        hook_score += 5
    if features["hook_has_colon"]:
        hook_score += 4
    scores["hook"] = min(20, hook_score)

    # Readability (10 points)
    max_points["readability"] = 10
    fg = features["flesch_grade"]
    if 6 <= fg <= 10:
        scores["readability"] = 10
    elif 4 <= fg <= 12:
        scores["readability"] = 7
    else:
        scores["readability"] = 3
        if fg > 12:
            suggestions.append(f"Readability grade is {fg:.1f} — aim for grade 6-10. Simpler language performs better on LinkedIn.")

    # Format (15 points)
    max_points["format"] = 15
    format_scores = {"document": 15, "poll": 14, "video": 13, "image": 10, "text": 5, "article": 7}
    ptype = ["text", "image", "video", "document", "poll", "article"][features["post_type_idx"]]
    scores["format"] = format_scores.get(ptype, 5)
    if ptype == "text":
        suggestions.append("Text-only posts get the lowest engagement. Consider adding an image, or reformatting as a carousel/document for 3-6x more engagement.")

    # Hashtags (10 points)
    max_points["hashtags"] = 10
    nh = features["num_hashtags"]
    if 1 <= nh <= 3:
        scores["hashtags"] = 10
    elif nh == 0:
        scores["hashtags"] = 3
        suggestions.append("No hashtags detected. Adding 1-3 niche hashtags boosts engagement by 12.6%.")
    elif 4 <= nh <= 5:
        scores["hashtags"] = 6
    else:
        scores["hashtags"] = 2
        suggestions.append(f"You have {nh} hashtags — more than 5 hurts engagement. Stick to 1-3 niche tags.")

    # CTA (10 points)
    max_points["cta"] = 10
    if features["has_cta"]:
        scores["cta"] = 10
    else:
        scores["cta"] = 2
        suggestions.append("No call-to-action detected. End with a question or prompt ('What do you think?', 'Share if you agree') to drive comments.")

    # Sentiment (5 points) — use pipeline RoBERTa composite when available
    max_points["sentiment"] = 5
    pipeline_sentiment = pipeline_enrichment.get("composite_sentiment")
    if pipeline_sentiment is not None:
        # RoBERTa composite sentiment (0-1 scale): ideal is mildly positive 0.55-0.80
        if 0.55 <= pipeline_sentiment <= 0.80:
            scores["sentiment"] = 5
        elif 0.40 <= pipeline_sentiment <= 0.90:
            scores["sentiment"] = 4
        elif 0.25 <= pipeline_sentiment:
            scores["sentiment"] = 3
        else:
            scores["sentiment"] = 1
    else:
        # Fallback: regex heuristic
        s = features["sentiment"]
        if 0.1 <= s <= 0.5:
            scores["sentiment"] = 5
        elif 0 <= s <= 0.7:
            scores["sentiment"] = 3
        else:
            scores["sentiment"] = 1

    # Formatting/structure (5 points)
    max_points["formatting"] = 5
    fs = features["formatting_score"]
    has_story = features["has_storytelling"]
    has_list = features["has_list"]
    fmt_score = int(fs * 3)
    if has_story:
        fmt_score += 1
    if has_list:
        fmt_score += 1
    scores["formatting"] = min(5, fmt_score)
    if fs < 0.3 and features["word_count"] > 50:
        suggestions.append("Add more line breaks for visual breathing room. Well-formatted posts get more dwell time.")

    # URL penalty note
    if features["has_url"]:
        suggestions.append("External links reduce organic reach by ~30% on LinkedIn. Consider putting the link in the first comment instead.")

    # ── Pipeline Enrichment (10 points) ──────────────────────────────
    # Signals from the wider Polaris pipeline that influence LinkedIn performance:
    #   trend_momentum (0-1): Is the topic trending? Trending topics get more impressions.
    #   cultural_risk  (0-1): Is any entity controversial? High risk = engagement ceiling.
    #   audience_alignment (0-1): Does the copy match the target audience?
    #   visual_quality (0-1): Platform fit of any attached media.
    #   resonance_score (0-1): How well do all entities cohere as a signal graph?
    max_points["pipeline_signals"] = 10
    pipeline_pts = 0
    pipeline_signal_count = 0

    trend_momentum = pipeline_enrichment.get("trend_momentum")
    if trend_momentum is not None:
        pipeline_signal_count += 1
        if trend_momentum >= 0.65:
            pipeline_pts += 3
        elif trend_momentum >= 0.45:
            pipeline_pts += 2
        elif trend_momentum >= 0.30:
            pipeline_pts += 1
        else:
            suggestions.append(
                f"Topic momentum is low ({trend_momentum:.0%}). Posts about trending topics get 2-3x more organic impressions on LinkedIn."
            )

    cultural_risk = pipeline_enrichment.get("cultural_risk")
    if cultural_risk is not None:
        pipeline_signal_count += 1
        safety = 1.0 - cultural_risk
        if safety >= 0.80:
            pipeline_pts += 2
        elif safety >= 0.50:
            pipeline_pts += 1
        else:
            suggestions.append(
                "Your post mentions entities with elevated cultural risk. LinkedIn's algorithm deprioritizes controversial content."
            )

    audience_alignment = pipeline_enrichment.get("audience_alignment")
    if audience_alignment is not None:
        pipeline_signal_count += 1
        if audience_alignment >= 0.70:
            pipeline_pts += 2
        elif audience_alignment >= 0.45:
            pipeline_pts += 1
        else:
            suggestions.append(
                f"Audience alignment is {audience_alignment:.0%}. Adjust your language and framing to better match your target audience."
            )

    visual_quality = pipeline_enrichment.get("visual_quality")
    if visual_quality is not None:
        pipeline_signal_count += 1
        if visual_quality >= 0.70:
            pipeline_pts += 2
        elif visual_quality >= 0.45:
            pipeline_pts += 1
        else:
            suggestions.append(
                "Media quality scored low for this platform. Use high-resolution, professional images or well-edited video."
            )

    resonance_score = pipeline_enrichment.get("resonance_score")
    if resonance_score is not None:
        pipeline_signal_count += 1
        if resonance_score >= 0.60:
            pipeline_pts += 1

    if pipeline_signal_count == 0:
        # No pipeline data available — remove the category entirely
        del max_points["pipeline_signals"]
    else:
        # Scale to 10 points proportionally based on how many signals are available
        max_possible = pipeline_signal_count * 2  # max 2 pts per signal (except trend=3)
        if trend_momentum is not None:
            max_possible += 1  # trend can give 3 pts
        if resonance_score is not None and max_possible > 0:
            pass  # resonance gives max 1 pt
        scores["pipeline_signals"] = min(10, round(pipeline_pts / max(1, max_possible) * 10))

    # Compute final score
    raw_total = sum(scores.values())
    raw_max = sum(max_points.values())
    total = round(raw_total / raw_max * 100) if raw_max > 0 else 0
    breakdown = {k: {"score": v, "max": max_points[k]} for k, v in scores.items()}

    return total, breakdown, suggestions


# ─── Main Prediction Function ──────────────────────────────────────

def predict_linkedin_performance(
    text: str,
    post_type: str = "text",
    follower_count: int = 5000,
    industry: str = "",
    hashtags: list = None,
    # ── Pipeline enrichment signals (optional) ──
    pipeline_enrichment: dict = None,
) -> dict:
    """
    Full LinkedIn post performance prediction.

    When pipeline_enrichment is provided (from the Polaris pipeline), richer
    signals replace internal heuristics and modulate predicted engagement:
      - composite_sentiment (float 0-1): RoBERTa composite replaces regex sentiment
      - trend_momentum (float 0-1): Topic momentum boosts/penalizes impressions
      - cultural_risk (float 0-1): Cultural risk caps engagement ceiling
      - audience_alignment (float 0-1): Audience fit amplifies engagement
      - visual_quality (float 0-1): Platform fit score of attached media
      - resonance_score (float 0-1): Entity graph resonance composite
      - trending_direction (str): 'ascending'|'stable'|'descending'|'viral'

    Returns dict with:
    - quality_score (0-100)
    - quality_breakdown (per-factor scores)
    - suggestions (list of improvement tips)
    - predicted_impressions (int)
    - predicted_reactions (int)
    - predicted_comments (int)
    - predicted_shares (int)
    - predicted_engagement_rate (float, 0-1)
    - impression_range (low, high)
    - timing_heatmap: 7x18 grid of predicted engagement by day × hour
    - best_times: top 5 (day, hour, engagement) tuples
    """
    if pipeline_enrichment is None:
        pipeline_enrichment = {}

    # Use best default time (Wed 9am) for the main prediction
    features = extract_features(
        text, post_type, follower_count, 2, 9, industry, hashtags
    )

    # Quality score (now pipeline-aware)
    quality_score, breakdown, suggestions = compute_quality_score(features, pipeline_enrichment)

    # Model prediction at optimal time
    model = _get_model()
    X = features_to_array(features)
    y_log = model.predict(X)[0]
    preds = np.expm1(y_log)

    impressions = max(10, int(preds[0]))
    reactions = max(0, int(preds[1]))
    comments = max(0, int(preds[2]))
    shares = max(0, int(preds[3]))

    # ── Pipeline-driven engagement modulation ──────────────────────
    # These multipliers adjust the ML model's predictions based on real-world
    # signals that the model cannot observe (it was trained on synthetic data
    # without access to trend/cultural/audience context).

    engagement_mult = 1.0

    # Trend momentum: trending topics get organically amplified by the algorithm
    trend_m = pipeline_enrichment.get("trend_momentum")
    if trend_m is not None:
        # 0.5 = neutral, >0.5 = boost, <0.5 = penalty
        # Range: 0.80x to 1.40x
        engagement_mult *= 0.80 + (trend_m * 0.60)

    # Cultural risk: controversial topics get suppressed by LinkedIn's algorithm
    c_risk = pipeline_enrichment.get("cultural_risk")
    if c_risk is not None:
        # risk 0 = no penalty, risk 1 = -40% engagement
        engagement_mult *= max(0.60, 1.0 - c_risk * 0.40)

    # Audience alignment: better targeting = better engagement
    aud_align = pipeline_enrichment.get("audience_alignment")
    if aud_align is not None:
        # Range: 0.85x to 1.20x
        engagement_mult *= 0.85 + (aud_align * 0.35)

    # Trending direction: viral topics get a burst boost
    trend_dir = pipeline_enrichment.get("trending_direction")
    if trend_dir == "viral":
        engagement_mult *= 1.25
    elif trend_dir == "ascending":
        engagement_mult *= 1.10
    elif trend_dir == "descending":
        engagement_mult *= 0.90

    # Apply engagement multiplier to predictions
    if engagement_mult != 1.0:
        impressions = max(10, int(impressions * engagement_mult))
        reactions = max(0, int(reactions * engagement_mult))
        comments = max(0, int(comments * engagement_mult))
        shares = max(0, int(shares * engagement_mult))

    total_engagement = reactions + comments + shares
    engagement_rate = total_engagement / max(1, impressions)

    imp_low = max(10, int(impressions * 0.6))
    imp_high = int(impressions * 1.5)

    # Generate timing heatmap: run model for every day × hour combo
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    hours = list(range(6, 23))  # 6am to 10pm
    heatmap = []
    all_combos = []

    for d_idx in range(7):
        row = []
        for h in hours:
            f = extract_features(text, post_type, follower_count, d_idx, h, industry, hashtags)
            X_t = features_to_array(f)
            y_t = np.expm1(model.predict(X_t)[0])
            imp = max(0, int(y_t[0]))
            eng = max(0, int(y_t[1] + y_t[2] + y_t[3]))
            eng_rate = eng / max(1, imp)
            row.append(round(eng_rate, 4))
            all_combos.append((d_idx, h, eng_rate))
        heatmap.append(row)

    # Top 5 best times
    all_combos.sort(key=lambda x: -x[2])
    best_times = [
        {"day": days[d], "hour": h, "engagement_rate": round(er, 4)}
        for d, h, er in all_combos[:5]
    ]

    return {
        "quality_score": quality_score,
        "quality_breakdown": breakdown,
        "suggestions": suggestions[:6],
        "predicted_impressions": impressions,
        "predicted_reactions": reactions,
        "predicted_comments": comments,
        "predicted_shares": shares,
        "predicted_engagement_rate": round(engagement_rate, 4),
        "impression_range": {"low": imp_low, "high": imp_high},
        "timing_heatmap": {
            "days": days,
            "hours": hours,
            "data": heatmap,
        },
        "best_times": best_times,
    }
