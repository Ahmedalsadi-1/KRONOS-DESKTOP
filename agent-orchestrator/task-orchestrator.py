#!/usr/bin/env python3
"""
Task Orchestrator Implementation
Intelligently routes tasks to the most appropriate agent based on capabilities, load, and historical performance.
"""

import asyncio
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import redis
import httpx


@dataclass
class Agent:
    id: str
    name: str
    type: str
    capabilities: List[str]
    status: str
    last_seen: datetime
    current_load: int = 0
    success_rate: float = 1.0


@dataclass
class Task:
    id: str
    type: str
    payload: Dict
    priority: int = 1
    assigned_agent: Optional[str] = None
    status: str = "queued"
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()


class TaskOrchestrator:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.agents: Dict[str, Agent] = {}
        self.tasks: Dict[str, Task] = {}
        self._load_agents()

    def _load_agents(self):
        """Load agent configurations from registry"""
        # In production, this would query a service registry
        self.agents = {
            "kronos-desktop-1": Agent(
                id="kronos-desktop-1",
                name="Kronos Desktop Agent",
                type="desktop",
                capabilities=["screenshot", "file_operations", "browser_automation"],
                status="available",
                last_seen=datetime.now(),
            ),
            "kronos-computer-use-1": Agent(
                id="kronos-computer-use-1",
                name="Kronos Computer Use Agent",
                type="multi_agent",
                capabilities=["browser_automation", "terminal", "desktop_control"],
                status="available",
                last_seen=datetime.now(),
            ),
            "kronos-ui-tars-1": Agent(
                id="kronos-ui-tars-1",
                name="Kronos UI-TARS Vision Agent",
                type="vision_gui",
                capabilities=[
                    "gui_interaction",
                    "vision_analysis",
                    "action_prediction",
                ],
                status="available",
                last_seen=datetime.now(),
            ),
        }

    def select_best_agent(self, task: Task) -> Optional[Agent]:
        """Select the best agent for a task based on multiple factors"""

        # Filter agents by capability match
        capable_agents = [
            agent
            for agent in self.agents.values()
            if agent.status == "available"
            and any(
                cap in agent.capabilities for cap in self._get_task_capabilities(task)
            )
        ]

        if not capable_agents:
            return None

        # Score agents based on multiple criteria
        scored_agents = []
        for agent in capable_agents:
            score = self._calculate_agent_score(agent, task)
            scored_agents.append((agent, score))

        # Return highest scoring agent
        scored_agents.sort(key=lambda x: x[1], reverse=True)
        return scored_agents[0][0] if scored_agents else None

    def _get_task_capabilities(self, task: Task) -> List[str]:
        """Extract required capabilities from task"""
        capability_map = {
            "desktop_screenshot": ["screenshot"],
            "browser_click": ["browser_automation"],
            "gui_action": ["gui_interaction", "vision_analysis"],
            "file_operation": ["file_operations"],
            "terminal_command": ["terminal"],
            "social_media_post": ["social_media_api"],
            "video_download": ["content_download"],
            "workflow_execution": ["workflow_engine"],
        }
        return capability_map.get(task.type, [])

    def _calculate_agent_score(self, agent: Agent, task: Task) -> float:
        """Calculate agent suitability score"""
        base_score = 1.0

        # Load balancing factor (prefer less busy agents)
        load_factor = 1.0 / (1.0 + agent.current_load)

        # Success rate factor
        success_factor = agent.success_rate

        # Capability match factor
        task_caps = self._get_task_capabilities(task)
        match_count = sum(1 for cap in task_caps if cap in agent.capabilities)
        capability_factor = match_count / len(task_caps) if task_caps else 1.0

        # Priority factor for high-priority tasks
        priority_factor = 1.0 + (task.priority - 1) * 0.2

        return (
            base_score
            * load_factor
            * success_factor
            * capability_factor
            * priority_factor
        )

    async def execute_task(self, task: Task) -> Dict:
        """Execute a task using the best available agent"""

        # Select agent
        agent = self.select_best_agent(task)
        if not agent:
            raise ValueError(f"No suitable agent found for task type: {task.type}")

        # Update task and agent status
        task.assigned_agent = agent.id
        task.status = "running"
        task.started_at = datetime.now()
        agent.current_load += 1
        agent.status = "busy"

        try:
            # Route to appropriate service
            result = await self._route_to_agent(agent, task)

            # Update success metrics
            task.status = "completed"
            task.completed_at = datetime.now()
            agent.success_rate = (agent.success_rate * 0.9) + 0.1  # Rolling average

            return result

        except Exception as e:
            task.status = "failed"
            agent.success_rate = agent.success_rate * 0.9  # Penalize failure
            raise e

        finally:
            # Cleanup
            agent.current_load = max(0, agent.current_load - 1)
            if agent.current_load == 0:
                agent.status = "available"

    async def _route_to_agent(self, agent: Agent, task: Task) -> Dict:
        """Route task to specific agent service"""

        routes = {
            "kronos-desktop": "http://kronos-desktop:9991/api/execute",
            "kronos-computer-use": "http://kronos-computer-use:8001/api/execute",
            "kronos-ui-tars": "http://kronos-ui-tars:8000/api/execute",
            "kronos-gbox": "http://kronos-gbox:9999/api/execute",
        }

        base_url = routes.get(agent.type.split("-")[0])  # Extract base type
        if not base_url:
            raise ValueError(f"No route configured for agent type: {agent.type}")

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                base_url,
                json={"taskId": task.id, "type": task.type, "payload": task.payload},
            )
            response.raise_for_status()
            return response.json()

    async def monitor_agents(self):
        """Continuously monitor agent health and status"""
        while True:
            for agent in self.agents.values():
                try:
                    # Health check each agent
                    await self._check_agent_health(agent)
                except Exception as e:
                    print(f"Agent {agent.id} health check failed: {e}")
                    agent.status = "offline"

            await asyncio.sleep(30)  # Check every 30 seconds

    async def _check_agent_health(self, agent: Agent):
        """Check if agent is responsive"""
        # Implementation would ping agent health endpoint
        pass


# Usage example
async def main():
    # Initialize orchestrator
    orchestrator = TaskOrchestrator()

    # Create a task
    task = Task(
        id="task-123",
        type="browser_click",
        payload={"url": "https://example.com", "x": 100, "y": 200},
        priority=2,
    )

    # Execute task (automatically selects best agent)
    result = await orchestrator.execute_task(task)
    print(f"Task completed: {result}")


if __name__ == "__main__":
    asyncio.run(main())
