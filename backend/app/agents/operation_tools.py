import os
from typing import Any
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

from app.db.session import database
from app.schemas.task import TaskCreate
from app.models.task import TaskStatus, TaskType, TaskPriority
from app.services.task_service import TaskService


class TaskInput(BaseModel):
    title: str = Field(description="Görevin kısa başlığı")
    description: str = Field(description="Görevin detayları")
    assignee_id: int = Field(description="Depo için 1, Kargo için 2.")
    task_type: str = Field(description="Görev tipi: 'pack_order' (paketleme), 'ship_order' (kargolama), 'restock' (stok yenileme), 'general' (genel)")
    priority: str = Field(description="Öncelik: 'low', 'normal', 'high'")


async def _create_task(title: str, description: str, assignee_id: int, task_type: str, priority: str) -> str:
    async with database._session_factory() as session:
        service = TaskService(session)
        payload = TaskCreate(
            title=title,
            description=description,
            status=TaskStatus.TODO,
            task_type=TaskType(task_type),
            priority=TaskPriority(priority),
            assignee_id=assignee_id
        )
        await service.create(payload)
        await session.commit()
        return f"Başarılı: '{title}' görevi oluşturuldu ({task_type}, {priority})."


async def run_operations_agent(task_service: Any, pending_orders_data: str) -> dict:
    create_task_tool = StructuredTool.from_function(
        coroutine=_create_task,
        name="create_system_task",
        description="Sistemde yeni bir görev oluşturur.",
        args_schema=TaskInput,
    )

    tools = [create_task_tool]
    api_key = os.environ.get("GOOGLE_API_KEY")
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, google_api_key=api_key)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Sen operasyon yöneticisisin. Bekleyen siparişleri analiz et ve
        'create_system_task' aracını kullanarak görevler oluştur.

        Kurallar:
        - Depo ekibine (assignee_id=1) paketleme görevi: task_type='pack_order', priority='high'
        - Kargo ekibine (assignee_id=2) kargolama görevi: task_type='ship_order', priority='high'
        - Aynı bölgedeki siparişleri tek görevde birleştir.
        
        Bitince özet rapor ver."""),
        ("human", "Bekleyen siparişler:\n{orders_data}"),
        ("placeholder", "{agent_scratchpad}"),
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    result = await agent_executor.ainvoke({"orders_data": pending_orders_data})
    return {"ai_report": result["output"]}
