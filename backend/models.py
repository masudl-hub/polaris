from pydantic import BaseModel, Field
from typing import List, Optional


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
    status: str = Field(default="ok", description="ok | skipped | error")
    note: Optional[str] = Field(default=None, description="Status note (e.g., 'no API token')")


class QuantitativeMetrics(BaseModel):
    """All deterministic ML pipeline outputs bundled together"""
    text_data: TextAnalysis
    vision_data: VisionAnalysis
    trend_data: Optional[TrendAnalysis] = Field(default=None, description="Google Trends analysis (None if unavailable)")
    sem_metrics: SEMMetrics
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
