#!/usr/bin/env python3
"""
KRONOS Distributed Tracing MCP Server
Provides OpenTelemetry instrumentation, Jaeger integration, and distributed tracing tools
for all KRONOS platform services through Model Context Protocol.
"""

import json
import asyncio
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
import aiohttp
import os
import uuid
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/var/log/kronos-tracing-mcp.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class TraceContext:
    """Distributed trace context for correlation"""

    trace_id: str
    span_id: str
    correlation_id: Optional[str] = None
    parent_trace_id: Optional[str] = None
    baggage: Dict[str, str]
    sampling_decision: Optional[str] = None


@dataclass
class ServiceMetrics:
    """Service performance metrics from tracing data"""

    service_name: str
    operation_count: int
    error_count: int
    avg_duration_ms: float
    p95_duration_ms: float
    throughput: float
    sampling_rate: float


class TracingMCPServer:
    """MCP Server for KRONOS distributed tracing management"""

    def __init__(self):
        self.jaeger_endpoint = os.getenv("JAEGER_ENDPOINT", "http://jaeger:16686")
        self.otel_collector_endpoint = os.getenv(
            "OTEL_COLLECTOR_ENDPOINT", "http://otel-collector:4317"
        )
        self.service_registry_endpoint = os.getenv(
            "SERVICE_REGISTRY_ENDPOINT", "http://kronos-service-registry:8080"
        )

        # Performance baselines for different service types
        self.service_baselines = {
            "api-gateway": {
                "max_p99_latency_ms": 1000,
                "max_error_rate": 0.01,
                "min_throughput": 50,
            },
            "service-registry": {
                "max_p99_latency_ms": 500,
                "max_error_rate": 0.005,
                "min_throughput": 100,
            },
            "browser-automation": {
                "max_p99_latency_ms": 5000,
                "max_error_rate": 0.1,
                "min_throughput": 10,
            },
        }

    async def list_tools(self):
        """List available MCP tools"""
        return {
            "tools": [
                {
                    "name": "get_trace_context",
                    "description": "Get distributed trace context for correlation",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "trace_id": {
                                "type": "string",
                                "description": "Trace ID to get context for",
                            },
                            "include_spans": {
                                "type": "boolean",
                                "default": false,
                                "description": "Include detailed span information",
                            },
                        },
                    },
                },
                {
                    "name": "correlate_traces",
                    "description": "Correlate traces across services using correlation IDs",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "correlation_id": {
                                "type": "string",
                                "description": "Correlation ID to search for",
                            },
                            "time_window_minutes": {
                                "type": "integer",
                                "default": 60,
                                "description": "Time window in minutes to search",
                            },
                            "services": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Specific services to include (empty for all)",
                            },
                        },
                    },
                },
                {
                    "name": "analyze_service_performance",
                    "description": "Analyze service performance using tracing data",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Service name to analyze",
                            },
                            "time_window_minutes": {
                                "type": "integer",
                                "default": 60,
                                "description": "Time window for analysis",
                            },
                            "metric_types": {
                                "type": "array",
                                "items": {"type": "string"},
                                "enum": [
                                    "latency",
                                    "throughput",
                                    "error_rate",
                                    "sampling_efficiency",
                                ],
                                "description": "Types of metrics to analyze",
                            },
                        },
                    },
                },
                {
                    "name": "trace_service_dependencies",
                    "description": "Extract service dependencies from trace data",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "trace_id": {
                                "type": "string",
                                "description": "Trace ID to analyze for dependencies",
                            }
                        },
                    },
                },
                {
                    "name": "optimize_sampling_strategy",
                    "description": "Recommend optimal sampling strategies based on service characteristics",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Service name to optimize",
                            },
                            "current_metrics": {
                                "type": "object",
                                "description": "Current performance metrics",
                            },
                            "service_type": {
                                "type": "string",
                                "enum": [
                                    "critical",
                                    "high_throughput",
                                    "ml_processing",
                                    "user_facing",
                                ],
                                "description": "Service type classification",
                            },
                        },
                    },
                },
                {
                    "name": "inject_trace_context",
                    "description": "Inject distributed trace context into HTTP requests",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "target_service": {
                                "type": "string",
                                "description": "Service to inject context into",
                            },
                            "trace_id": {
                                "type": "string",
                                "description": "Trace ID to inject",
                            },
                            "span_id": {
                                "type": "string",
                                "description": "Span ID to inject",
                            },
                            "correlation_id": {
                                "type": "string",
                                "description": "Correlation ID to inject",
                            },
                            "headers": {
                                "type": "object",
                                "description": "Additional headers to inject",
                            },
                        },
                    },
                },
                {
                    "name": "create_trace_span",
                    "description": "Create a new trace span with context",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Service creating the span",
                            },
                            "operation_name": {
                                "type": "string",
                                "description": "Operation name for the span",
                            },
                            "parent_span_id": {
                                "type": "string",
                                "description": "Parent span ID (optional)",
                            },
                            "correlation_id": {
                                "type": "string",
                                "description": "Correlation ID for trace linking",
                            },
                            "tags": {
                                "type": "object",
                                "description": "Tags to add to the span",
                            },
                            "attributes": {
                                "type": "object",
                                "description": "Attributes to add to the span",
                            },
                            "start_time": {
                                "type": "string",
                                "description": "Start time in ISO format",
                            },
                        },
                    },
                },
                {
                    "name": "propagate_trace_context",
                    "description": "Propagate trace context across service boundaries",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "from_service": {
                                "type": "string",
                                "description": "Source service name",
                            },
                            "to_service": {
                                "type": "string",
                                "description": "Target service name",
                            },
                            "trace_context": {
                                "type": "object",
                                "description": "Trace context to propagate",
                            },
                            "propagation_method": {
                                "type": "string",
                                "enum": [
                                    "http_headers",
                                    "message_queue",
                                    "grpc_metadata",
                                ],
                                "description": "Method of context propagation",
                            },
                        },
                    },
                },
                {
                    "name": "generate_trace_report",
                    "description": "Generate comprehensive trace analysis report",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "services": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Services to include in report",
                            },
                            "time_range": {
                                "type": "object",
                                "properties": {
                                    "start_time": {
                                        "type": "string",
                                        "description": "Start time in ISO format",
                                    },
                                    "end_time": {
                                        "type": "string",
                                        "description": "End time in ISO format",
                                    },
                                    "duration_hours": {
                                        "type": "integer",
                                        "default": 24,
                                        "description": "Duration in hours",
                                    },
                                },
                            },
                            "include_anomalies": {
                                "type": "boolean",
                                "default": true,
                                "description": "Include anomaly detection in report",
                            },
                            "include_recommendations": {
                                "type": "boolean",
                                "default": true,
                                "description": "Include optimization recommendations",
                            },
                        },
                    },
                },
                {
                    "name": "get_service_health",
                    "description": "Get distributed tracing health status",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "services": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Specific services to check (empty for all)",
                            }
                        },
                    },
                },
            ]
        }

    async def get_trace_context(
        self, trace_id: str, include_spans: bool = False
    ) -> Dict[str, Any]:
        """Get distributed trace context for correlation"""
        try:
            url = f"{self.jaeger_endpoint}/api/traces/{trace_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        trace = data.get("data", [])

                        if trace and len(trace) > 0:
                            spans = trace[0].get("spans", [])
                            context = {
                                "trace_id": trace_id,
                                "span_count": len(spans),
                                "service_name": trace[0]
                                .get("process", {})
                                .get("serviceName", "unknown"),
                                "start_time": spans[0].get("startTime")
                                if spans
                                else None,
                                "duration_ms": trace[0].get("duration", 0) / 1000,
                                "correlation_ids": list(set()),
                                "status": "found",
                            }

                            # Extract correlation IDs
                            correlation_ids = set()
                            for span in spans:
                                tags = span.get("tags", [])
                                for tag in tags:
                                    if tag.get("key") in [
                                        "correlation.id",
                                        "x-correlation-id",
                                        "trace-correlation-id",
                                    ]:
                                        correlation_ids.add(tag.get("value"))

                            context["correlation_ids"] = list(correlation_ids)

                            if include_spans:
                                context["spans"] = spans

                            return context

            return {
                "trace_id": trace_id,
                "status": "not_found",
                "message": "Trace not found in Jaeger",
            }

        except Exception as e:
            logger.error(f"Failed to get trace context {trace_id}: {e}")
            return {"trace_id": trace_id, "status": "error", "error": str(e)}

    async def correlate_traces(
        self,
        correlation_id: str,
        time_window_minutes: int = 60,
        services: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Correlate traces across services using correlation ID"""
        try:
            params = {"limit": 1000, "lookback": f"{time_window_minutes}m"}

            # Add service filter if specified
            if services:
                params["service"] = ",".join(services)

            url = f"{self.jaeger_endpoint}/api/traces"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, params=params, timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        traces = data.get("data", [])

                        correlated_traces = []
                        for trace_data in traces:
                            spans = trace_data.get("spans", [])
                            if any(
                                span.get("tags", {}).get("correlation.id")
                                == correlation_id
                                for span in spans
                            ):
                                correlated_traces.append(
                                    {
                                        "trace_id": trace_data.get(
                                            "traceID", "unknown"
                                        ),
                                        "service_name": trace_data.get(
                                            "process", {}
                                        ).get("serviceName", "unknown"),
                                        "span_count": len(spans),
                                        "start_time": spans[0].get("startTime")
                                        if spans
                                        else None,
                                        "correlation_confirmed": True,
                                    }
                                )

                        return {
                            "correlation_id": correlation_id,
                            "traces_found": len(correlated_traces),
                            "traces": correlated_traces,
                        }

            return {
                "correlation_id": correlation_id,
                "status": "error",
                "error": "Failed to correlate traces",
            }

        except Exception as e:
            logger.error(f"Trace correlation failed: {e}")
            return {
                "correlation_id": correlation_id,
                "status": "error",
                "error": str(e),
            }

    async def analyze_service_performance(
        self,
        service_name: str,
        time_window_minutes: int = 60,
        metric_types: List[str] = None,
    ) -> Dict[str, Any]:
        """Analyze service performance using distributed tracing data"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(minutes=time_window_minutes)

            # Query Jaeger for service traces
            params = {
                "service": service_name,
                "start": start_time.isoformat() + "Z",
                "end": end_time.isoformat() + "Z",
                "limit": 1000,
            }

            url = f"{self.jaeger_endpoint}/api/traces"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, params=params, timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        traces = data.get("data", [])

                        metrics = self._calculate_service_metrics(
                            traces, time_window_minutes
                        )

                        result = {
                            "service_name": service_name,
                            "time_window_minutes": time_window_minutes,
                            "total_traces": len(traces),
                            "metrics": metrics,
                            "analysis_timestamp": datetime.now().isoformat(),
                        }

                        if not metric_types or "latency" in metric_types:
                            result["latency_analysis"] = self._analyze_latency_patterns(
                                traces
                            )

                        if not metric_types or "throughput" in metric_types:
                            result["throughput_analysis"] = (
                                self._analyze_throughput_patterns(
                                    traces, time_window_minutes
                                )
                            )

                        if not metric_types or "error_rate" in metric_types:
                            result["error_analysis"] = self._analyze_error_patterns(
                                traces
                            )

                        if not metric_types or "sampling_efficiency" in metric_types:
                            result["sampling_analysis"] = (
                                self._analyze_sampling_efficiency(traces)
                            )

                        return result

            return {
                "service_name": service_name,
                "status": "error",
                "error": "Failed to analyze service performance",
            }

        except Exception as e:
            logger.error(f"Service performance analysis failed: {e}")
            return {"service_name": service_name, "status": "error", "error": str(e)}

    def _calculate_service_metrics(
        self, traces: List[Dict[str, Any]], time_window_minutes: int
    ) -> ServiceMetrics:
        """Calculate performance metrics from trace data"""
        if not traces:
            return ServiceMetrics(
                service_name="",
                operation_count=0,
                error_count=0,
                avg_duration_ms=0,
                p95_duration_ms=0,
                throughput=0,
                sampling_rate=0,
            )

        total_operations = 0
        total_errors = 0
        durations = []

        for trace in traces:
            spans = trace.get("spans", [])
            for span in spans:
                total_operations += 1
                duration_ms = span.get("duration", 0) / 1000
                if duration_ms > 0:
                    durations.append(duration_ms)

                # Check for errors
                if span.get("warnings") or span.get("logs"):
                    total_errors += 1

        # Calculate metrics
        avg_duration = sum(durations) / len(durations) if durations else 0
        p95_duration = sorted(durations)[int(len(durations) * 0.95)] if durations else 0
        throughput = (
            len(traces) / (time_window_minutes * 60) if time_window_minutes > 0 else 0
        )
        error_rate = total_errors / total_operations if total_operations > 0 else 0
        sampling_rate = 1.0  # This would be calculated from actual sampling data

        # Extract service name from first trace
        service_name = (
            traces[0].get("process", {}).get("serviceName", "unknown")
            if traces
            else "unknown"
        )

        return ServiceMetrics(
            service_name=service_name,
            operation_count=total_operations,
            error_count=total_errors,
            avg_duration_ms=avg_duration,
            p95_duration_ms=p95_duration,
            throughput=throughput,
            sampling_rate=sampling_rate,
        )

    def _analyze_latency_patterns(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze latency patterns from trace data"""
        if not traces:
            return {}

        durations = []
        for trace in traces:
            spans = trace.get("spans", [])
            for span in spans:
                duration_ms = span.get("duration", 0) / 1000
                if duration_ms > 0:
                    durations.append(duration_ms)

        if not durations:
            return {}

        durations.sort()
        percentiles = {
            "p50": durations[len(durations) // 2],
            "p90": durations[int(len(durations) * 0.9)],
            "p95": durations[int(len(durations) * 0.95)],
            "p99": durations[int(len(durations) * 0.99)],
        }

        return {
            "duration_distribution": {
                "min_ms": min(durations),
                "max_ms": max(durations),
                "mean_ms": sum(durations) / len(durations),
                "percentiles_ms": percentiles,
            },
            "performance_tier": self._classify_performance(percentiles["p95"]),
            "outlier_detection": {
                "count_outliers": len(
                    [d for d in durations if d > percentiles["p99"] * 1.5]
                ),
                "outlier_threshold_ms": percentiles["p99"] * 1.5,
            },
        }

    def _analyze_throughput_patterns(
        self, traces: List[Dict[str, Any]], time_window_minutes: int
    ) -> Dict[str, Any]:
        """Analyze throughput patterns from trace data"""
        if not traces:
            return {}

        # Group traces by time buckets
        time_buckets = {}
        for trace in traces:
            start_time = trace.get("spans", [{}])[0].get("startTime")
            if start_time:
                # Convert to datetime and round to nearest minute
                dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                bucket = dt.replace(second=0, microsecond=0)
                if bucket not in time_buckets:
                    time_buckets[bucket] = 0
                time_buckets[bucket] += 1

        return {
            "traces_per_minute": time_buckets,
            "peak_throughput": max(time_buckets.values()) if time_buckets else 0,
            "avg_throughput": len(traces) / time_window_minutes,
            "throughput_variance": max(time_buckets.values())
            - min(time_buckets.values())
            if time_buckets
            else 0,
        }

    def _analyze_error_patterns(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze error patterns from trace data"""
        if not traces:
            return {}

        error_operations = []
        error_types = {}

        for trace in traces:
            spans = trace.get("spans", [])
            for span in spans:
                if span.get("warnings") or span.get("logs"):
                    error_operations.append(
                        {
                            "operation": span.get("operationName", "unknown"),
                            "error_type": "span_error",
                            "timestamp": span.get("startTime"),
                            "service": trace.get("process", {}).get(
                                "serviceName", "unknown"
                            ),
                        }
                    )

                    # Analyze error logs
                    logs = span.get("logs", [])
                    for log in logs:
                        if log.get("fields", {}).get("error.object"):
                            error_type = log.get("fields", {}).get(
                                "error.object", "unknown"
                            )
                            error_types[error_type] = error_types.get(error_type, 0) + 1

        return {
            "total_errors": len(error_operations),
            "error_types": dict(error_types),
            "error_rate_trend": "increasing"
            if len(error_operations) > len(traces) * 0.05
            else "stable",
        }

    def _analyze_sampling_efficiency(
        self, traces: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze sampling efficiency from trace data"""
        if not traces:
            return {}

        # This is a simplified analysis - in real implementation,
        # we would compare against actual sampling configuration
        return {
            "total_traces_sampled": len(traces),
            "estimated_total_requests": len(traces) * 10,  # Assume 10% sampling rate
            "sampling_efficiency": "adequate" if len(traces) > 50 else "insufficient",
            "recommendation": "Increase sampling rate for high-traffic services"
            if len(traces) < 50
            else "Current sampling is adequate",
        }

    def _classify_performance(self, p95_latency_ms: float) -> str:
        """Classify performance based on P95 latency"""
        if p95_latency_ms < 100:
            return "excellent"
        elif p95_latency_ms < 250:
            return "good"
        elif p95_latency_ms < 500:
            return "fair"
        elif p95_latency_ms < 1000:
            return "poor"
        else:
            return "critical"


async def handle_mcp_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle incoming MCP requests"""
    method = request_data.get("method", "")
    params = request_data.get("params", {})

    try:
        if method == "get_trace_context":
            trace_id = params.get("trace_id")
            include_spans = params.get("include_spans", False)
            return await self.get_trace_context(trace_id, include_spans)

        elif method == "correlate_traces":
            correlation_id = params.get("correlation_id")
            time_window_minutes = params.get("time_window_minutes", 60)
            services = params.get("services")
            return await self.correlate_traces(
                correlation_id, time_window_minutes, services
            )

        elif method == "analyze_service_performance":
            service_name = params.get("service_name")
            time_window_minutes = params.get("time_window_minutes", 60)
            metric_types = params.get("metric_types")
            return await self.analyze_service_performance(
                service_name, time_window_minutes, metric_types
            )

        elif method == "generate_trace_report":
            services = params.get("services", [])
            time_range = params.get("time_range", {})
            include_anomalies = params.get("include_anomalies", True)
            include_recommendations = params.get("include_recommendations", True)
            return await self.generate_trace_report(
                services, time_range, include_anomalies, include_recommendations
            )

        elif method == "list_tools":
            return await self.list_tools()

        else:
            return {
                "error": f"Unknown method: {method}",
                "available_methods": [
                    "get_trace_context",
                    "correlate_traces",
                    "analyze_service_performance",
                    "generate_trace_report",
                    "list_tools",
                ],
            }

    except Exception as e:
        logger.error(f"MCP request failed: {e}")
        return {"error": str(e), "method": method}

    async def generate_trace_report(
        self,
        services: List[str],
        time_range: Dict[str, Any],
        include_anomalies: bool = True,
        include_recommendations: bool = True,
    ) -> Dict[str, Any]:
        """Generate comprehensive trace analysis report"""
        try:
            report = {
                "generated_at": datetime.now().isoformat(),
                "time_range": time_range,
                "services": {},
                "summary": {
                    "total_services": len(services),
                    "total_traces_analyzed": 0,
                    "anomalies_detected": 0,
                    "recommendations_count": 0,
                },
                "anomalies": [],
                "recommendations": [],
            }

            for service_name in services:
                # Get performance metrics
                perf_result = await self.analyze_service_performance(
                    service_name,
                    time_range.get("duration_hours", 24) * 60,
                    ["latency", "throughput", "error_rate"],
                )

                if perf_result.get("status") == "error":
                    report["services"][service_name] = {
                        "status": "error",
                        "error": perf_result.get("error"),
                    }
                    continue

                report["services"][service_name] = {
                    "status": "analyzed",
                    "metrics": perf_result.get("metrics"),
                    "analysis": {
                        "latency": perf_result.get("latency_analysis", {}),
                        "throughput": perf_result.get("throughput_analysis", {}),
                        "errors": perf_result.get("error_analysis", {}),
                        "sampling": perf_result.get("sampling_analysis", {}),
                    },
                }

                report["summary"]["total_traces_analyzed"] += perf_result.get(
                    "metrics", {}
                ).get("operation_count", 0)

                # Add anomalies if requested
                if include_anomalies:
                    anomalies = await self._detect_service_anomalies(service_name)
                    if anomalies:
                        report["anomalies"].extend(anomalies)
                        report["summary"]["anomalies_detected"] += len(anomalies)

                # Add recommendations if requested
                if include_recommendations:
                    recommendations = await self._generate_service_recommendations(
                        service_name, perf_result.get("metrics")
                    )
                    if recommendations:
                        report["recommendations"].extend(recommendations)
                        report["summary"]["recommendations_count"] += len(
                            recommendations
                        )

            return report

        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return {"error": str(e), "generated_at": datetime.now().isoformat()}

    async def _detect_service_anomalies(
        self, service_name: str
    ) -> List[Dict[str, Any]]:
        """Detect performance anomalies for a specific service"""
        try:
            # Get recent performance data
            recent_perf = await self.analyze_service_performance(
                service_name, 30, ["error_rate", "latency"]
            )

            if recent_perf.get("status") == "error":
                return []

            metrics = recent_perf.get("metrics")
            anomalies = []

            # Check against service baselines
            baseline = self.service_baselines.get(service_name, {})
            if baseline:
                if metrics.error_rate > baseline.get("max_error_rate", 0.01):
                    anomalies.append(
                        {
                            "type": "high_error_rate",
                            "severity": "warning",
                            "description": f"Error rate ({metrics.error_rate:.3f}) exceeds baseline ({baseline.get('max_error_rate', 0.01)})",
                            "current_value": metrics.error_rate,
                            "baseline_value": baseline.get("max_error_rate"),
                        }
                    )

                if metrics.avg_duration_ms > baseline.get("max_p99_latency_ms", 500):
                    anomalies.append(
                        {
                            "type": "high_latency",
                            "severity": "warning",
                            "description": f"Average latency ({metrics.avg_duration_ms:.1f}ms) exceeds baseline ({baseline.get('max_p99_latency_ms', 500)}ms)",
                            "current_value": metrics.avg_duration_ms,
                            "baseline_value": baseline.get("max_p99_latency_ms"),
                        }
                    )

            return anomalies

        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}")
            return []

    async def _generate_service_recommendations(
        self, service_name: str, metrics: ServiceMetrics
    ) -> List[Dict[str, Any]]:
        """Generate optimization recommendations for a service"""
        recommendations = []

        # Sampling recommendations
        if metrics.sampling_rate > 0.5:  # High sampling rate
            recommendations.append(
                {
                    "type": "sampling_optimization",
                    "priority": "high",
                    "description": f"High sampling rate ({metrics.sampling_rate:.1f}) detected. Consider reducing to 0.1-0.2 for better performance",
                    "action": "Adjust OTEL_TRACES_SAMPLER environment variable",
                }
            )
        elif metrics.sampling_rate < 0.05:  # Very low sampling rate
            recommendations.append(
                {
                    "type": "sampling_optimization",
                    "priority": "medium",
                    "description": f"Very low sampling rate ({metrics.sampling_rate:.1f}) may miss important errors. Consider increasing to 0.1-0.3",
                    "action": "Adjust OTEL_TRACES_SAMPLER environment variable",
                }
            )

        # Performance recommendations
        if metrics.error_count > 0 and metrics.avg_duration_ms > 1000:
            recommendations.append(
                {
                    "type": "performance_optimization",
                    "priority": "high",
                    "description": f"High latency with errors detected. Consider performance optimization",
                    "action": "Investigate slow operations and optimize critical paths",
                }
            )

        # Throughput recommendations
        if metrics.throughput < 10 and service_name == "api-gateway":
            recommendations.append(
                {
                    "type": "scaling_recommendation",
                    "priority": "medium",
                    "description": f"Low throughput detected. Consider horizontal scaling",
                    "action": "Add more API gateway instances",
                }
            )

        return recommendations


async def main():
    """Main entry point for the tracing MCP server"""
    server = TracingMCPServer()

    print("🔍 KRONOS Distributed Tracing MCP Server Starting...")
    print(f"📊 Jaeger: {server.jaeger_endpoint}")
    print(f"📈 OTEL Collector: {server.otel_collector_endpoint}")

    # MCP server would typically run as stdio transport
    # For this implementation, we'll demonstrate with a simple interactive mode
    try:
        print("🛠️  Available MCP Tools:")
        tools = await server.list_tools()
        for tool in tools["tools"]:
            print(f"   - {tool['name']}: {tool['description']}")

        print("\n📋 Example usage:")
        print("   get_trace_context - Get trace context for correlation")
        print("   correlate_traces - Correlate traces across services")
        print("   analyze_service_performance - Analyze service performance")
        print("   generate_trace_report - Generate comprehensive reports")
        print("\n✅ Distributed tracing MCP server ready")

    except KeyboardInterrupt:
        print("\n🛑 Tracing MCP server stopped")
    except Exception as e:
        print(f"❌ Tracing MCP server failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
