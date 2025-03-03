defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  import Ecto.Query
  alias TradingFoursWeb.Presence
  alias TradingFours.Chat.Message
  alias TradingFours.Repo
  alias Phoenix.PubSub
  
  def topic(room_id), do: "chat:#{room_id}"
  def presence_topic(room_id), do: "chat:#{room_id}:presence"
  def pending_rooms_topic, do: "pending_rooms"

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

  # Room will always have exactly 2 users when matched

  def mount(%{"room_id" => room_id}, _session, socket) do
    if connected?(socket) do
      PubSub.subscribe(TradingFours.PubSub, topic(room_id))
      PubSub.subscribe(TradingFours.PubSub, presence_topic(room_id))
      PubSub.subscribe(TradingFours.PubSub, pending_rooms_topic())
    end

    messages =
      Repo.all(
        from m in Message,
          where: m.room_id == ^room_id,
          order_by: [asc: m.inserted_at],
          limit: 100
      )

    # Generate a random user ID (not username) for presence tracking
    user_id = "user_" <> Ecto.UUID.generate()
    color = Enum.random(@colors)

    # Immediately join the room with the user ID
    if connected?(socket) do
      {:ok, _} =
        Presence.track(
          self(),
          presence_topic(room_id),
          user_id,
          %{
            color: color,
            online_at: inspect(System.system_time(:second)),
            joined_at: System.monotonic_time()
          }
        )

      # Mark this room as pending if it's new
      check_and_track_pending_room(room_id)
    end

    # Set up initial state
    {:ok,
     assign(socket,
       room_id: room_id,
       messages: messages,
       user_id: user_id,
       user_color: color,
       online_users: %{},
       room_status: "waiting", # "waiting" or "matched"
       system_message: "Waiting for another musician to join..."
     )}
  end

  def handle_event("send_midi", %{"sequence" => mds}, socket) do
    sequence = Jason.decode!(mds)

    message_params = %{
      midi_sequence: sequence,
      author: socket.assigns.user_id,
      room_id: socket.assigns.room_id,
      color: socket.assigns.user_color
    }

    message =
      %Message{}
      |> Message.changeset(message_params)
      |> Repo.insert!()

    # Broadcast to all users in the room
    PubSub.broadcast(
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
    room_id = socket.assigns.room_id
    
    # Get current users in room
    online_users =
      Presence.list(presence_topic(room_id))
      |> Enum.map(fn {username, %{metas: [meta | _]}} ->
        {username, meta}
      end)
      |> Enum.into(%{})
    
    user_count = map_size(online_users)

    # Handle user joins/leaves and update status messages
    socket = 
      case {user_count, socket.assigns.room_status} do
        # First user in a new room
        {1, _} ->
          # Mark room as pending
          track_pending_room(room_id)
          
          assign(socket,
            online_users: online_users,
            room_status: "waiting",
            system_message: "Waiting for another musician to join..."
          )
          
        # Second user just joined - room is now full
        {2, "waiting"} ->
          # Remove room from pending list
          untrack_pending_room(room_id)
          
          # Update all users with the matched status
          PubSub.broadcast(
            TradingFours.PubSub,
            topic(room_id),
            {:room_matched}
          )
          
          # Rename other user to "Stranger" for this user
          renamed_users = rename_other_user(online_users, socket.assigns.user_id)
          
          assign(socket,
            online_users: renamed_users,
            room_status: "matched",
            system_message: "You're now trading fours with a stranger! Start the conversation."
          )
          
        # User left a matched room
        {1, "matched"} ->
          assign(socket,
            online_users: online_users,
            room_status: "abandoned",
            system_message: "Your partner left. Want to find a new musician?"
          )
        
        # Room is empty - could be cleaned up
        {0, _} ->
          untrack_pending_room(room_id)
          
          assign(socket,
            online_users: %{},
            room_status: "empty"
          )
        
        # Default case - just update user list
        _ ->
          # Always rename other users to "Stranger"
          renamed_users = rename_other_user(online_users, socket.assigns.user_id)
          
          assign(socket,
            online_users: renamed_users
          )
      end
    
    {:noreply, socket}
  end
  
  # Handle when a room becomes matched
  def handle_info({:room_matched}, socket) do
    {:noreply, assign(socket,
      room_status: "matched",
      system_message: "You're now trading fours with a stranger! Start the conversation."
    )}
  end
  
  # Handle pending room events
  def handle_info({:new_pending_room, _room_id}, socket) do
    # Only relevant for the redirect controller
    {:noreply, socket}
  end
  
  def handle_info({:room_filled, _room_id}, socket) do
    # Only relevant for the redirect controller
    {:noreply, socket}
  end
  
  # Check if room is already tracked as pending, if not track it
  defp check_and_track_pending_room(room_id) do
    user_count = 
      Presence.list(presence_topic(room_id))
      |> map_size()
    
    # If this is the first user, track as pending
    if user_count <= 1 do
      track_pending_room(room_id)
    end
  end
  
  # Track a room as waiting for more users
  defp track_pending_room(room_id) do
    Presence.track(
      self(),
      pending_rooms_topic(),
      room_id,
      %{
        created_at: System.system_time(:second)
      }
    )
  end
  
  # Remove room from pending list
  defp untrack_pending_room(room_id) do
    PubSub.broadcast(
      TradingFours.PubSub,
      pending_rooms_topic(),
      {:room_filled, room_id}
    )
  end
  
  # Rename all other users to "Stranger" for privacy
  defp rename_other_user(users, current_user_id) do
    users
    |> Enum.map(fn 
      {^current_user_id, meta} -> {"You", meta}
      {_other_user_id, meta} -> {"Stranger", meta}
    end)
    |> Enum.into(%{})
  end
end
