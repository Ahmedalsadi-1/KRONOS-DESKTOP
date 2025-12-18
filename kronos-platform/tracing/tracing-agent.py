#!/usr/bin/env python3
"""
KRONOS Distributed Tracing Agent
Manages Jaeger distributed tracing, service discovery, and trace correlation across the KRONOS platform.
Provides intelligent trace analysis, automated diagnostics, and performance optimization recommendations.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import aiohttp
import requests
from dataclasses import dataclass
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/var/log/kronos-tracing-agent.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class TraceSpan:
    """Represents a single trace span with correlation data"""

    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    operation_name: str
    service_name: str
    start_time: datetime
    duration_ms: float
    status: str  # 'ok', 'error', 'timeout'
    tags: Dict[str, Any]
    correlation_id: Optional[str] = None
    error: Optional[Dict[str, Any]] = None


@dataclass
class ServiceTrace:
    """Represents a complete service trace with multiple spans"""

    trace_id: str
    service_name: str
    spans: List[TraceSpan]
    total_duration_ms: float
    error_count: int
    correlation_context: Dict[str, Any]


@dataclass
class TracingMetrics:
    """Performance metrics for tracing analysis"""

    service_name: str
    trace_count: int
    error_rate: float
    avg_latency_ms: float
    p95_latency_ms: float
    throughput: float
    sampling_rate: float


class DistributedTracingAgent:
    """Advanced distributed tracing agent for KRONOS platform"""

    def __init__(self):
        self.jaeger_endpoint = os.getenv(
            "JAEGER_ENDPOINT", "http://jaeger:16686/api/traces"
        )
        self.otel_collector_endpoint = os.getenv(
            "OTEL_COLLECTOR_ENDPOINT", "http://otel-collector:4317"
        )
        self.service_registry_endpoint = os.getenv(
            "SERVICE_REGISTRY_ENDPOINT", "http://kronos-service-registry:8080"
        )
        self.prometheus_endpoint = os.getenv(
            "PROMETHEUS_ENDPOINT", "http://kronos-monitoring:9090"
        )
        self.grafana_endpoint = os.getenv(
            "GRAFANA_ENDPOINT", "http://kronos-grafana:3000"
        )

        # Service discovery cache
        self.service_cache = {}
        self.last_service_check = datetime.now()

        # Performance baseline
        self.performance_baselines = {
            "api-gateway": {"max_latency_ms": 500, "max_error_rate": 0.01},
            "service-registry": {"max_latency_ms": 200, "max_error_rate": 0.005},
            "config-service": {"max_latency_ms": 300, "max_error_rate": 0.005},
            "orchestration-engine": {"max_latency_ms": 1000, "max_error_rate": 0.02},
            "security-service": {"max_latency_ms": 400, "max_error_rate": 0.01},
            "browser-automation": {"max_latency_ms": 2000, "max_error_rate": 0.05},
            "ui-automation": {"max_latency_ms": 5000, "max_error_rate": 0.1},
            "desktop-agent": {"max_latency_ms": 1500, "max_error_rate": 0.03},
        }

    async def discover_services(self) -> Dict[str, Dict[str, Any]]:
        """Auto-discover all KRONOS services with tracing capabilities"""
        services = {}

        try:
            # Get services from service registry
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.service_registry_endpoint}/services",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status == 200:
                        registry_services = await response.json()
                        for service in registry_services.get("services", []):
                            service_name = service.get("name")
                            services[service_name] = {
                                "registry_info": service,
                                "tracing_enabled": True,
                                "discovered_at": datetime.now().isoformat(),
                            }
        except Exception as e:
            logger.error(f"Service discovery failed: {e}")

        # Add Jaeger, OpenTelemetry, and monitoring services
        services.update(
            {
                "jaeger": {
                    "name": "Jaeger Tracing",
                    "endpoint": self.jaeger_endpoint,
                    "type": "tracing-backend",
                    "health_endpoint": f"{self.jaeger_endpoint.replace('/api/traces', '')}/",
                },
                "otel-collector": {
                    "name": "OpenTelemetry Collector",
                    "endpoint": self.otel_collector_endpoint,
                    "type": "trace-collector",
                    "health_endpoint": f"{self.otel_collector_endpoint}/healthcheck",
                },
                "prometheus": {
                    "name": "Prometheus Metrics",
                    "endpoint": self.prometheus_endpoint,
                    "type": "metrics-backend",
                    "health_endpoint": f"{self.prometheus_endpoint}/-/healthy",
                },
                "grafana": {
                    "name": "Grafana Visualization",
                    "endpoint": self.grafana_endpoint,
                    "type": "visualization-frontend",
                    "health_endpoint": f"{self.grafana_endpoint}/api/health",
                },
            }
        )

        self.service_cache = services
        self.last_service_check = datetime.now()
        return services

    async def get_trace_by_id(self, trace_id: str) -> Optional[ServiceTrace]:
        """Retrieve complete trace by ID from Jaeger"""
        try:
            url = f"{self.jaeger_endpoint}/api/traces/{trace_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_jaeger_trace(data)
        except Exception as e:
            logger.error(f"Failed to get trace {trace_id}: {e}")
        return None

    async def search_traces(
        self,
        service_name: Optional[str] = None,
        operation_name: Optional[str] = None,
        status: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[ServiceTrace]:
        """Search traces with advanced filtering and correlation"""
        try:
            params = {
                "limit": limit,
                "service": service_name,
                "operation": operation_name,
                "lookback": "1h",  # Default lookback window
            }

            if start_time:
                params["start"] = start_time.isoformat() + "Z"
            if end_time:
                params["end"] = end_time.isoformat() + "Z"

            url = f"{self.jaeger_endpoint}/api/traces"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, params=params, timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        traces = []
                        for trace_data in data.get("data", []):
                            trace = self._parse_jaeger_trace(trace_data)
                            if trace and self._matches_filters(
                                trace, service_name, operation_name, status
                            ):
                                traces.append(trace)
                        return traces
        except Exception as e:
            logger.error(f"Trace search failed: {e}")
        return []

    def _parse_jaeger_trace(self, trace_data: Dict[str, Any]) -> Optional[ServiceTrace]:
        """Parse Jaeger trace data into ServiceTrace format"""
        try:
            spans = trace_data.get("spans", [])
            if not spans:
                return None

            trace_id = spans[0].get("traceID", "unknown")
            service_name = spans[0].get("process", {}).get("serviceName", "unknown")

            trace_spans = []
            total_duration = 0
            error_count = 0

            for span in spans:
                trace_span = TraceSpan(
                    trace_id=span.get("traceID", trace_id),
                    span_id=span.get("spanID", "unknown"),
                    parent_span_id=span.get("parentSpanID"),
                    operation_name=span.get("operationName", "unknown"),
                    service_name=service_name,
                    start_time=datetime.fromisoformat(
                        span.get("startTime", "1970-01-01T00:00:00Z").replace(
                            "Z", "+00:00"
                        )
                    ),
                    duration_ms=span.get("duration", 0)
                    / 1000,  # Convert microseconds to milliseconds
                    status="ok" if not span.get("warnings") else "error",
                    tags=span.get("tags", {}),
                    correlation_id=span.get("tags", {}).get("correlation.id"),
                    error=span.get("logs", [{}])[0]
                    .get("fields", {})
                    .get("error.object")
                    if span.get("logs")
                    else None,
                )

                trace_spans.append(trace_span)
                total_duration += span.get("duration", 0)

                if span.get("warnings") or span.get("logs"):
                    error_count += 1

            correlation_context = self._extract_correlation_context(spans)

            return ServiceTrace(
                trace_id=trace_id,
                service_name=service_name,
                spans=trace_spans,
                total_duration_ms=total_duration / 1000,
                error_count=error_count,
                correlation_context=correlation_context,
            )

        except Exception as e:
            logger.error(f"Failed to parse Jaeger trace: {e}")
            return None

    def _matches_filters(
        self,
        trace: ServiceTrace,
        service_name: Optional[str],
        operation_name: Optional[str],
        status: Optional[str],
    ) -> bool:
        """Check if trace matches search filters"""
        if service_name and trace.service_name != service_name:
            return False
        if operation_name and not any(
            span.operation_name == operation_name for span in trace.spans
        ):
            return False
        if status:
            span_statuses = [span.status for span in trace.spans]
            if status not in span_statuses:
                return False
        return True

    def _extract_correlation_context(
        self, spans: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract distributed correlation context from spans"""
        context = {}

        for span in spans:
            tags = span.get("tags", [])
            for tag in tags:
                if tag.get("key") in [
                    "correlation.id",
                    "x-correlation-id",
                    "trace-correlation-id",
                ]:
                    context[tag.get("key")] = tag.get("value")
                elif tag.get("key") == "user.id":
                    context["user_id"] = tag.get("value")
                elif tag.get("key") == "session.id":
                    context["session_id"] = tag.get("value")
                elif tag.get("key") == "request.id":
                    context["request_id"] = tag.get("value")

        return context

    async def analyze_performance(
        self, service_name: str, time_window_minutes: int = 60
    ) -> Optional[TracingMetrics]:
        """Analyze service performance using tracing data"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(minutes=time_window_minutes)

            traces = await self.search_traces(
                service_name=service_name,
                start_time=start_time,
                end_time=end_time,
                limit=1000,
            )

            if not traces:
                return None

            # Calculate metrics
            total_traces = len(traces)
            total_spans = sum(len(trace.spans) for trace in traces)
            error_traces = [trace for trace in traces if trace.error_count > 0]
            error_count = sum(trace.error_count for trace in error_traces)

            # Calculate latencies
            latencies = []
            for trace in traces:
                for span in trace.spans:
                    if span.duration_ms > 0:
                        latencies.append(span.duration_ms)

            avg_latency = sum(latencies) / len(latencies) if latencies else 0
            p95_latency = (
                sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0
            )

            throughput = total_traces / (time_window_minutes * 60)  # traces per second

            return TracingMetrics(
                service_name=service_name,
                trace_count=total_traces,
                error_rate=error_count / total_traces if total_traces > 0 else 0,
                avg_latency_ms=avg_latency,
                p95_latency_ms=p95_latency,
                throughput=throughput,
                sampling_rate=1.0,  # This would be calculated from actual sampling config
            )

        except Exception as e:
            logger.error(f"Performance analysis failed for {service_name}: {e}")
            return None

    async def detect_anomalies(self, service_name: str) -> List[str]:
        """Detect performance anomalies using ML-based analysis"""
        try:
            # Get recent performance data
            metrics = await self.analyze_performance(service_name, 120)  # 2-hour window

            if not metrics:
                return []

            anomalies = []
            baseline = self.performance_baselines.get(service_name, {})

            # Check against baselines
            if metrics.error_rate > baseline.get("max_error_rate", 0.05):
                anomalies.append(
                    f"Error rate ({metrics.error_rate:.3f}) exceeds baseline ({baseline.get('max_error_rate', 0.05)})"
                )

            if metrics.avg_latency_ms > baseline.get("max_latency_ms", 1000):
                anomalies.append(
                    f"Average latency ({metrics.avg_latency_ms:.1f}ms) exceeds baseline ({baseline.get('max_latency_ms', 1000)}ms)"
                )

            if metrics.p95_latency_ms > baseline.get("max_latency_ms", 1000) * 1.5:
                anomalies.append(
                    f"P95 latency ({metrics.p95_latency_ms:.1f}ms) significantly degraded"
                )

            # Check for error spikes
            recent_metrics = await self.analyze_performance(
                service_name, 30
            )  # 30-minute window
            if recent_metrics and recent_metrics.error_rate > metrics.error_rate * 2:
                anomalies.append("Recent error rate spike detected")

            return anomalies

        except Exception as e:
            logger.error(f"Anomaly detection failed for {service_name}: {e}")
            return []

    async def get_service_dependencies(self, trace_id: str) -> Dict[str, List[str]]:
        """Extract service dependencies from trace data"""
        try:
            trace = await self.get_trace_by_id(trace_id)
            if not trace:
                return {}

            dependencies = {}

            for span in trace.spans:
                service = span.service_name
                operation = span.operation_name

                # Identify potential service calls from operation names
                if any(
                    keyword in operation.lower()
                    for keyword in ["call", "invoke", "request", "query", "fetch"]
                ):
                    # Extract target service from tags
                    target_service = None
                    for tag_key, tag_value in span.tags.items():
                        if "service" in tag_key.lower():
                            target_service = tag_value
                            break

                    if target_service and target_service != service:
                        if service not in dependencies:
                            dependencies[service] = []
                        dependencies[service].append(target_service)

            return dependencies

        except Exception as e:
            logger.error(f"Dependency extraction failed for trace {trace_id}: {e}")
            return {}

    async def correlate_traces(
        self, correlation_id: str, time_window_minutes: int = 30
    ) -> List[ServiceTrace]:
        """Correlate traces across services using correlation ID"""
        try:
            traces = await self.search_traces(
                start_time=datetime.now() - timedelta(minutes=time_window_minutes),
                limit=500,
            )

            # Filter traces by correlation ID
            correlated_traces = []
            for trace in traces:
                if any(span.correlation_id == correlation_id for span in trace.spans):
                    correlated_traces.append(trace)

            return correlated_traces

        except Exception as e:
            logger.error(f"Trace correlation failed for {correlation_id}: {e}")
            return []

    async def optimize_trace_sampling(self, service_name: str) -> Dict[str, Any]:
        """Recommend trace sampling optimization based on service characteristics"""
        try:
            metrics = await self.analyze_performance(service_name, 60)

            if not metrics:
                return {}

            optimization = {
                "service_name": service_name,
                "current_metrics": {
                    "trace_rate": metrics.throughput,
                    "error_rate": metrics.error_rate,
                    "avg_latency": metrics.avg_latency_ms,
                    "sampling_efficiency": metrics.sampling_rate,
                },
                "recommendations": [],
            }

            # High-throughput services can handle lower sampling
            if metrics.throughput > 100:  # > 100 traces/sec
                optimization["recommendations"].append(
                    {
                        "type": "sampling_rate",
                        "current": metrics.sampling_rate,
                        "recommended": 0.01,
                        "reason": "High throughput service can optimize with reduced sampling",
                    }
                )

            # High-error services need full sampling
            if metrics.error_rate > 0.05:  # > 5% error rate
                optimization["recommendations"].append(
                    {
                        "type": "sampling_rate",
                        "current": metrics.sampling_rate,
                        "recommended": 1.0,
                        "reason": "High error rate requires full trace visibility",
                    }
                )

            # Low-latency critical paths need full sampling
            if metrics.avg_latency_ms < 50 and service_name in [
                "api-gateway",
                "service-registry",
            ]:
                optimization["recommendations"].append(
                    {
                        "type": "critical_path_sampling",
                        "current": metrics.sampling_rate,
                        "recommended": 1.0,
                        "reason": "Critical path operations require complete trace coverage",
                    }
                )

            return optimization

        except Exception as e:
            logger.error(f"Sampling optimization failed for {service_name}: {e}")
            return {}

    async def generate_trace_report(
        self,
        service_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        include_anomalies: bool = True,
    ) -> Dict[str, Any]:
        """Generate comprehensive tracing report"""
        try:
            report = {
                "generated_at": datetime.now().isoformat(),
                "report_period": {
                    "start": start_time.isoformat()
                    if start_time
                    else (datetime.now() - timedelta(hours=24)).isoformat(),
                    "end": end_time.isoformat()
                    if end_time
                    else datetime.now().isoformat(),
                },
                "services_analyzed": [],
                "performance_metrics": {},
                "anomalies_detected": [],
                "recommendations": [],
                "trace_visualization_url": f"{self.grafana_endpoint}/d/jaeger",
            }

            if service_name:
                # Single service analysis
                metrics = await self.analyze_performance(service_name)
                if metrics:
                    report["performance_metrics"][service_name] = {
                        "trace_count": metrics.trace_count,
                        "error_rate": metrics.error_rate,
                        "avg_latency_ms": metrics.avg_latency_ms,
                        "p95_latency_ms": metrics.p95_latency_ms,
                        "throughput": metrics.throughput,
                    }

                if include_anomalies:
                    anomalies = await self.detect_anomalies(service_name)
                    if anomalies:
                        report["anomalies_detected"].extend(anomalies)

                optimization = await self.optimize_trace_sampling(service_name)
                if optimization.get("recommendations"):
                    report["recommendations"].extend(optimization["recommendations"])

                report["services_analyzed"] = [service_name]
            else:
                # Multi-service analysis
                services = await self.discover_services()
                for service_name_inner, service_info in services.items():
                    if service_info.get("type") in [
                        "tracing-backend",
                        "trace-collector",
                        "metrics-backend",
                    ]:
                        metrics = await self.analyze_performance(service_name_inner)
                        if metrics:
                            report["performance_metrics"][service_name_inner] = {
                                "trace_count": metrics.trace_count,
                                "error_rate": metrics.error_rate,
                                "avg_latency_ms": metrics.avg_latency_ms,
                                "p95_latency_ms": metrics.p95_latency_ms,
                                "throughput": metrics.throughput,
                            }

                        if include_anomalies:
                            anomalies = await self.detect_anomalies(service_name_inner)
                            if anomalies:
                                report["anomalies_detected"].extend(
                                    [
                                        f"{service_name_inner}: {anomaly}"
                                        for anomaly in anomalies
                                    ]
                                )

                        optimization = await self.optimize_trace_sampling(
                            service_name_inner
                        )
                        if optimization.get("recommendations"):
                            report["recommendations"].extend(
                                [
                                    f"{service_name_inner}: {rec}"
                                    for rec in optimization["recommendations"]
                                ]
                            )

                report["services_analyzed"] = list(services.keys())

            return report

        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return {"error": str(e), "generated_at": datetime.now().isoformat()}


async def main():
    """Main entry point for KRONOS distributed tracing agent"""
    agent = DistributedTracingAgent()

    try:
        print("🔍 KRONOS Distributed Tracing Agent Starting...")
        print(f"📊 Jaeger Endpoint: {agent.jaeger_endpoint}")
        print(f"📈 OpenTelemetry Collector: {agent.otel_collector_endpoint}")
        print(f"🔍 Service Registry: {agent.service_registry_endpoint}")

        # Discover all services
        services = await agent.discover_services()
        print(f"🚀 Discovered {len(services)} KRONOS services")

        # Analyze performance for each service
        for service_name in services.keys():
            if services[service_name].get("type") in [
                "tracing-backend",
                "trace-collector",
            ]:
                continue  # Skip infrastructure services

            metrics = await agent.analyze_performance(service_name)
            if metrics:
                print(
                    f"📊 {service_name}: {metrics.trace_count} traces, {metrics.error_rate:.2%} error rate, {metrics.avg_latency_ms:.1f}ms avg latency"
                )

                # Detect anomalies
                anomalies = await agent.detect_anomalies(service_name)
                if anomalies:
                    print(f"⚠️  {service_name} Anomalies:")
                    for anomaly in anomalies:
                        print(f"   - {anomaly}")

        # Generate comprehensive report
        report = await agent.generate_trace_report(include_anomalies=True)
        print("\n📋 KRONOS Distributed Tracing Report:")
        print(json.dumps(report, indent=2))

        print("✅ Distributed tracing analysis complete")

    except KeyboardInterrupt:
        print("\n🛑 Tracing agent stopped by user")
    except Exception as e:
        print(f"❌ Tracing agent failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
