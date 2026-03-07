from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class PipelineStep(BaseModel):
    """A single step in the evaluation pipeline trace"""
    step: int = Field(description="Step number (1-based)")
    name: str = Field(description="Pipeline stage name")
    model: str = Field(description="Model or method used")
    input_summary: str = Field(description="What was fed into this step")
    output_summary: str = Field(description="What came out")
    duration_ms: int = Field(description="How long this step took in milliseconds")
    status: str = Field(default="ok", description="ok | warning | error")
    note: Optional[str] = Field(default=None, description="Any warnings or notes")


class SentimentBreakdown(BaseModel):
    """Raw RoBERTa sentiment probabilities"""
    positive: float = Field(description="Positive sentiment probability")
    neutral: float = Field(description="Neutral sentiment probability")
    negative: float = Field(description="Negative sentiment probability")


class CompositeAdSentiment(BaseModel):
    """Fused sentiment score drawing from all available pipeline signals."""
    composite_score: float = Field(
        ge=0.0, le=1.0,
        description="Final weighted sentiment score (0=negative, 1=positive)"
    )
    ad_copy_score: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="RoBERTa sentiment on headline + body + OCR text. Weight: 0.35"
    )
    cultural_score: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="Mean cultural_sentiment across Perplexity Sonar entity contexts. Weight: 0.30"
    )
    reddit_score: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="RoBERTa avg sentiment across Reddit post titles for ad entities. Weight: 0.20"
    )
    landing_score: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="sentiment_alignment from landing page coherence check. Weight: 0.15"
    )
    signals_available: int = Field(
        default=1,
        description="Number of signals that contributed (1-4)"
    )
    effective_weights: dict = Field(
        default_factory=dict,
        description="Renormalized weights actually used {signal_name: weight}"
    )


class TextAnalysis(BaseModel):
    """Results from the Semantic Pipeline (spaCy NER + RoBERTa + Word2Vec)"""
    extracted_entities: List[str] = Field(description="Named entities extracted via spaCy NER")
    sentiment_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="RoBERTa composite score")
    sentiment_breakdown: Optional[SentimentBreakdown] = Field(default=None, description="Raw pos/neg/neu probabilities")
    suggested_tags: List[str] = Field(description="Semantically similar hashtags via GloVe Word2Vec")


class VisionAnalysis(BaseModel):
    """Results from the Visual Pipeline (Gemini Vision)"""
    visual_tags: List[str] = Field(description="Objects, products, elements identified")
    extracted_text: Optional[str] = Field(default=None, description="Text read from the image via OCR")
    brand_detected: Optional[str] = Field(default=None, description="Brand or logo identified")
    style_assessment: Optional[str] = Field(default=None, description="Visual style notes")
    is_cluttered: bool = Field(description="True if visual is cluttered")
    platform_fit: Optional[str] = Field(default=None, description="How well creative fits the target platform (good/fair/poor)")
    platform_fit_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, description="Numeric platform fit score (1-10) from Gemini vision")
    platform_suggestions: Optional[str] = Field(default=None, description="Platform-specific improvement suggestions")


class SEMMetrics(BaseModel):
    """Results from the SEM Bidding Simulator"""
    quality_score: float = Field(ge=1.0, le=10.0, description="Multi-modal Ad Quality Score (1-10)")
    effective_cpc: float = Field(description="Simulated effective Cost-Per-Click")
    daily_clicks: int = Field(description="Estimated daily clicks = budget / effective_cpc")


class TrendAnalysis(BaseModel):
    """Results from Google Trends pipeline"""
    momentum: Optional[float] = Field(default=None, description="7d vs 30d momentum (0-1 scale, None if unavailable)")
    related_queries_top: List[str] = Field(default_factory=list, description="Top related search queries")
    related_queries_rising: List[str] = Field(default_factory=list, description="Rising/breakout search queries")
    top_regions: List[dict] = Field(default_factory=list, description="Top regions [{name, interest}] with relative interest 0-100")
    keywords_searched: List[str] = Field(default_factory=list, description="Keywords that were queried")
    data_points: int = Field(default=0, description="Number of data points retrieved")
    time_series: List[float] = Field(default_factory=list, description="Daily interest values (90 days)")


class EntityNode(BaseModel):
    """Per-entity trend profile from a single pytrends query (Phase 3)."""
    name: str = Field(description="Entity name as extracted by spaCy NER")
    momentum: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="7d vs 30d momentum (0-1 sigmoid scale). None if pytrends returned no data."
    )
    related_queries_top: List[str] = Field(
        default_factory=list,
        description="Top related search queries for this entity (up to 8)"
    )
    related_queries_rising: List[str] = Field(
        default_factory=list,
        description="Rising/breakout search queries for this entity (up to 5)"
    )
    top_regions: List[dict] = Field(
        default_factory=list,
        description="Top 5 regions for this entity [{name, interest}] — interest is 0-100"
    )
    time_series: List[float] = Field(
        default_factory=list,
        description="Daily interest values over 90 days (0-100 scale, pytrends normalized)"
    )


class EntityAtomization(BaseModel):
    """Collection of per-entity trend profiles for all entities found in the ad (Phase 3)."""
    nodes: List[EntityNode] = Field(
        description="One EntityNode per entity, ordered by spaCy extraction order"
    )
    aggregate_momentum: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="Median of all node momenta. More robust than mean for heterogeneous entity sets."
    )


class EntityCulturalContext(BaseModel):
    """Perplexity Sonar-sourced cultural intelligence for a single entity (Phase 4)."""
    entity_name: str = Field(description="Entity name (from spaCy NER or EntityAtomization)")
    cultural_sentiment: str = Field(
        description="Current public sentiment: 'positive', 'negative', 'neutral', or 'mixed'"
    )
    trending_direction: str = Field(
        description="Cultural trajectory: 'ascending', 'stable', 'descending', or 'viral'"
    )
    narrative_summary: str = Field(
        description="2-3 sentence synthesis of current cultural narrative around this entity"
    )
    advertising_risk: str = Field(
        description="Advertising risk level: 'low', 'medium', or 'high'"
    )
    advertising_risk_reason: Optional[str] = Field(
        default=None,
        description="One sentence explaining why this risk level was assigned"
    )
    cultural_moments: List[str] = Field(
        default_factory=list,
        description="Up to 3 specific current events or cultural moments tied to this entity"
    )
    adjacent_topics: List[str] = Field(
        default_factory=list,
        description="Up to 4 culturally adjacent topics relevant to advertisers"
    )


class CulturalContext(BaseModel):
    """Perplexity Sonar cultural intelligence for the top-momentum entities in the ad (Phase 4)."""
    entity_contexts: List[EntityCulturalContext] = Field(
        description="Cultural context per queried entity, ordered by momentum (highest first)"
    )
    overall_advertising_risk: str = Field(
        description="Worst-case advertising risk across all entities: 'low', 'medium', or 'high'"
    )


class SignalNode(BaseModel):
    """A single entity in the resonance graph with four orthogonal signal dimensions (Phase 5)."""
    entity: str = Field(description="Entity name (from NER output)")
    node_type: str = Field(default="topic", description="brand | person | location | event | audio | topic")
    momentum_score: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Trend momentum (0-1). From Phase 3 EntityAtomization if available, else 0.5 neutral.")
    cultural_risk: float = Field(ge=0.0, le=1.0, default=0.0,
        description="Cultural safety risk (0=safe, 1=high risk). From Phase 4 CulturalContext. Default 0.0.")
    sentiment_signal: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Sentiment alignment (0-1). Global RoBERTa sentiment_score applied uniformly across nodes.")
    platform_affinity: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Platform fit (0-1). From vision platform_fit_score (1-10 -> 0-1) if media present, else 0.5.")
    weight: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Composite node weight = momentum * (1 - cultural_risk) * sentiment_signal * platform_affinity. Floor 0.01.")


class SignalEdge(BaseModel):
    """A weighted edge between two SignalNodes (Phase 5)."""
    source: str = Field(description="Source entity name (lexicographically smaller)")
    target: str = Field(description="Target entity name (lexicographically larger)")
    similarity: float = Field(ge=0.0, le=1.0,
        description="GloVe cosine similarity between entity embeddings. 0.0 if either entity OOV.")


class ResonanceGraph(BaseModel):
    """Converged signal graph combining all pipeline outputs (Phase 5)."""
    nodes: List[SignalNode] = Field(default_factory=list)
    edges: List[SignalEdge] = Field(default_factory=list)
    composite_resonance_score: float = Field(ge=0.0, le=1.0, default=0.0,
        description="Macro score = mean(node weights). 0.0 if no nodes.")
    dominant_signals: List[str] = Field(default_factory=list,
        description="Top-3 entity names sorted by node weight descending.")
    resonance_tier: str = Field(default="low",
        description="high (>=0.60) | moderate (>=0.35) | low (<0.35)")
    node_count: int = Field(default=0, description="Total number of signal nodes.")
    edge_count: int = Field(default=0, description="Total number of edges above similarity threshold.")


class IndustryBenchmark(BaseModel):
    """Industry benchmark comparison data"""
    industry: str = Field(description="Industry vertical")
    platform: str = Field(description="Ad platform")
    avg_cpc: float = Field(description="Industry average CPC")
    avg_ctr: float = Field(description="Industry average CTR (%)")
    avg_cvr: float = Field(description="Industry average conversion rate (%)")
    avg_cpa: float = Field(description="Industry average CPA")
    user_ecpc: Optional[float] = Field(default=None, description="User's simulated eCPC for comparison")
    cpc_delta_pct: Optional[float] = Field(default=None, description="% difference from industry avg CPC")
    verdict: Optional[str] = Field(default=None, description="above_average | average | below_average")


class LandingPageCoherence(BaseModel):
    """Landing page coherence analysis"""
    url: str = Field(description="Landing page URL analyzed")
    coherence_score: float = Field(ge=0.0, le=1.0, description="Overall coherence score (0-1)")
    matched_entities: List[str] = Field(default_factory=list, description="Ad entities found on landing page")
    missing_entities: List[str] = Field(default_factory=list, description="Ad entities NOT found on landing page")
    sentiment_alignment: Optional[float] = Field(default=None, description="Sentiment similarity between ad and page")
    headline_found: bool = Field(default=False, description="Whether ad headline appears on landing page")
    issues: List[str] = Field(default_factory=list, description="Specific coherence issues found")


class RedditSentiment(BaseModel):
    """Reddit community sentiment analysis"""
    query: str = Field(description="Search query used")
    post_count: int = Field(default=0, description="Number of posts analyzed")
    avg_sentiment: Optional[float] = Field(default=None, description="Average sentiment score (0-1)")
    sentiment_breakdown: Optional[SentimentBreakdown] = Field(default=None, description="Aggregate pos/neu/neg breakdown")
    themes: List[str] = Field(default_factory=list, description="Common themes/topics found")
    language_patterns: List[str] = Field(default_factory=list, description="Recurring phrases or language patterns")
    top_subreddits: List[str] = Field(default_factory=list, description="Most relevant subreddits")


class CreativeAlignment(BaseModel):
    """Trend-to-creative alignment analysis"""
    alignment_score: float = Field(ge=0.0, le=1.0, description="Overall alignment score (0-1)")
    matched_trends: List[str] = Field(default_factory=list, description="Trending queries that align with ad copy")
    gap_trends: List[str] = Field(default_factory=list, description="Trending queries NOT reflected in ad copy")
    creative_angles: List[str] = Field(default_factory=list, description="Suggested creative angles from trends")


class LinkedInPostAnalysis(BaseModel):
    """LinkedIn post performance prediction"""
    quality_score: int = Field(ge=0, le=100, description="Content quality score (0-100)")
    quality_breakdown: dict = Field(description="Per-factor score breakdown")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions")
    predicted_impressions: int = Field(description="Predicted impression count")
    predicted_reactions: int = Field(description="Predicted reaction count")
    predicted_comments: int = Field(description="Predicted comment count")
    predicted_shares: int = Field(description="Predicted share/repost count")
    predicted_engagement_rate: float = Field(description="Predicted engagement rate (0-1)")
    impression_range: dict = Field(description="Impression range {low, high}")
    timing_heatmap: dict = Field(default_factory=dict, description="7x17 engagement rate grid {days, hours, data}")
    best_times: List[dict] = Field(default_factory=list, description="Top 5 best posting times [{day, hour, engagement_rate}]")


class AudienceAnalysis(BaseModel):
    """Audience-copy alignment scoring via IAB taxonomy + sentence embeddings"""
    selected_tag: str = Field(description="The audience tag the user selected")
    alignment_score: float = Field(ge=0.0, le=1.0, description="How well ad copy matches the selected audience (0-1)")
    top_audiences: List[dict] = Field(default_factory=list, description="All audience tags ranked by alignment [{tag, score}]")


class CompetitorIntel(BaseModel):
    """Meta Ad Library competitor intelligence"""
    brand: str = Field(description="Competitor brand searched")
    ad_count: int = Field(default=0, description="Number of active ads found")
    avg_longevity_days: Optional[float] = Field(default=None, description="Average ad run length in days")
    format_breakdown: dict = Field(default_factory=dict, description="Count of ads by format (image/video/carousel)")
    top_creative_themes: List[str] = Field(default_factory=list, description="Common visual/copy tactical observations")
    win_rate_estimate: Optional[float] = Field(default=None, description="Heuristic estimate of ad efficiency (0-1)")
    market_share_proxy: Optional[str] = Field(default=None, description="Relative weight: 'Challenger', 'Leader', 'Niche', 'Dominant'")
    status: str = Field(default="ok", description="ok | skipped | error")
    note: Optional[str] = Field(default=None, description="Status note (e.g., 'no API token')")


class SceneBreakdown(BaseModel):
    """One contiguous scene identified by Gemini in a video or image."""
    scene_number: int = Field(description="Sequential scene number starting at 1")
    start_seconds: float = Field(description="Scene start time in seconds")
    end_seconds: float = Field(description="Scene end time in seconds")
    duration_seconds: float = Field(description="Scene duration in seconds")
    primary_setting: str = Field(description="Setting or environment of this scene")
    key_entities: List[str] = Field(default_factory=list, description="Brands, people, products, places visible")
    visual_summary: str = Field(description="One-sentence description of what happens")
    all_ocr_text: List[str] = Field(default_factory=list, description="Every text string visible in this scene")


class SongIdentification(BaseModel):
    """Song identified from video audio via AudD fingerprinting (Phase 2)."""
    title: str = Field(description="Song title")
    artist: str = Field(description="Artist name")
    album: Optional[str] = Field(default=None, description="Album name")
    release_date: Optional[str] = Field(default=None, description="Release date string (YYYY-MM-DD or YYYY)")
    match_timecode: Optional[str] = Field(default=None, description="Position in song that matched (MM:SS format)")
    song_link: Optional[str] = Field(default=None, description="Listen link from AudD")
    trend_momentum: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="Pytrends 7d/30d momentum for '{title} {artist}' (0-1 scale, None if unavailable)"
    )


class AudioDescription(BaseModel):
    """Gemini's description of the audio track. Phase 2 adds song identification."""
    has_audio: bool = Field(description="Whether the video has an audio track")
    description: Optional[str] = Field(default=None, description="Natural language description of audio")
    song_id: Optional[SongIdentification] = Field(
        default=None,
        description="Song identified via AudD audio fingerprinting. None if no music or no API key."
    )


class MediaDecomposition(BaseModel):
    """Full structured decomposition of a video or image from Gemini 3 Flash."""
    media_type: str = Field(description="'image' or 'video'")
    duration_seconds: Optional[float] = Field(default=None, description="Total duration in seconds (None for images)")
    scenes: List[SceneBreakdown] = Field(default_factory=list, description="All scenes identified")
    audio: Optional[AudioDescription] = Field(default=None, description="Audio description (None for images)")
    all_extracted_text: List[str] = Field(default_factory=list, description="Deduplicated text across all frames")
    all_entities: List[str] = Field(default_factory=list, description="Deduplicated entities across all frames")
    overall_visual_style: Optional[str] = Field(default=None, description="polished/ugc/minimal/bold/editorial/corporate")
    platform_fit: Optional[str] = Field(default=None, description="good/fair/poor")
    platform_fit_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, description="1–10 numeric fit score")
    brand_detected: Optional[str] = Field(default=None, description="Primary brand or logo detected")
    platform_suggestions: Optional[str] = Field(default=None, description="Platform-specific improvement suggestions")


class QuantitativeMetrics(BaseModel):
    """All deterministic ML pipeline outputs bundled together"""
    text_data: TextAnalysis
    vision_data: VisionAnalysis
    media_decomposition: Optional[MediaDecomposition] = Field(default=None, description="Full media decomposition from Gemini (Phase 1)")
    trend_data: Optional[TrendAnalysis] = Field(default=None, description="Google Trends analysis (None if unavailable)")
    entity_atomization: Optional[EntityAtomization] = Field(default=None, description="Per-entity trend profiles (Phase 3). Supplements trend_data which is a batch average.")
    cultural_context: Optional[CulturalContext] = Field(default=None, description="Perplexity Sonar cultural intelligence for top-momentum entities (Phase 4).")
    resonance_graph: Optional[ResonanceGraph] = Field(default=None, description="Resonance graph assembling all pipeline signals into weighted nodes and edges (Phase 5).")
    sem_metrics: SEMMetrics
    composite_sentiment: Optional[CompositeAdSentiment] = Field(default=None, description="Fused sentiment score from all available signals (ad copy, cultural, community, landing).")
    industry_benchmark: Optional[IndustryBenchmark] = Field(default=None, description="Industry benchmark comparison")
    landing_page: Optional[LandingPageCoherence] = Field(default=None, description="Landing page coherence analysis")
    reddit_sentiment: Optional[RedditSentiment] = Field(default=None, description="Reddit community sentiment")
    creative_alignment: Optional[CreativeAlignment] = Field(default=None, description="Trend-to-creative alignment")
    audience_analysis: Optional[AudienceAnalysis] = Field(default=None, description="Audience-copy alignment analysis")
    linkedin_analysis: Optional[LinkedInPostAnalysis] = Field(default=None, description="LinkedIn post performance prediction")
    competitor_intel: Optional[CompetitorIntel] = Field(default=None, description="Meta Ad Library competitor data")


class EvaluationResponse(BaseModel):
    """Complete API response for /api/v1/evaluate_ad"""
    status: str = "success"
    quantitative_metrics: QuantitativeMetrics
    executive_diagnostic: str = Field(description="LLM-generated executive diagnostic")
    pipeline_trace: List[PipelineStep] = Field(description="Step-by-step pipeline execution trace")


class ErrorResponse(BaseModel):
    """Error response"""
    status: str = "error"
    detail: str
