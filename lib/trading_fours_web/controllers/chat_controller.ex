defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  import Ecto.Query
  alias TradingFoursWeb.Presence
  alias TradingFours.Chat.Message
  alias TradingFours.Repo
  def topic(room_id), do: "chat:#{room_id}"
  def presence_topic(room_id), do: "chat:#{room_id}:presence"

  @colors [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEEAD",
    "#D4A5A5",
    "#9B59B6",
    "#3498DB",
    "#F1C40F",
    "#E74C3C"
  ]

  def mount(%{"room_id" => room_id}, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(TradingFours.PubSub, topic(room_id))
      Phoenix.PubSub.subscribe(TradingFours.PubSub, presence_topic(room_id))
    end

    messages =
      Repo.all(
        from m in Message,
          where: m.room_id == ^room_id,
          order_by: [asc: m.inserted_at],
          limit: 100
      )

    {:ok,
     assign(socket,
       room_id: room_id,
       messages: messages,
       username: nil,
       user_color: nil,
       online_users: %{}
     )}
  end

  def handle_event("set_username", %{"username" => username}, socket) do
    color = Enum.random(@colors)

    {:ok, _} =
      Presence.track(
        self(),
        presence_topic(socket.assigns.room_id),
        username,
        %{
          color: color,
          online_at: inspect(System.system_time(:second))
        }
      )

    {:noreply, assign(socket, username: username, user_color: color)}
  end

  def handle_event("send_midi", %{"sequence" => mds}, socket) do
    sequence = Jason.decode!(mds)
    IO.inspect(sequence, label: "Received MIDI Sequence")

    message_params = %{
      midi_sequence: sequence,
      author: socket.assigns.username,
      room_id: socket.assigns.room_id,
      color: socket.assigns.user_color
    }

    message =
      %Message{}
      |> Message.changeset(message_params)
      |> Repo.insert!()

    # Broadcast to all users in the room
    Phoenix.PubSub.broadcast(
      TradingFours.PubSub,
      topic(socket.assigns.room_id),
      {:new_message, message}
    )

    {:noreply, socket}
  end

  def handle_info({:new_message, message_item}, socket) do
    {:noreply, assign(socket, :messages, socket.assigns.messages ++ [message_item])}
  end

  def handle_info(%{event: "presence_diff", payload: _diff}, socket) do
    online_users =
      Presence.list(presence_topic(socket.assigns.room_id))
      |> Enum.map(fn {username, %{metas: [meta | _]}} ->
        {username, meta}
      end)
      |> Enum.into(%{})

    {:noreply, assign(socket, :online_users, online_users)}
  end
end
