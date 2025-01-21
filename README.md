# SLaks Home Assistant JS Code

_Ignore this repo; nothing to see here_

This repo contains Lovelace cards used by my internal Home Assistant instance.

This is primarily intended for internal use.

![HACS Logo](https://hacs.xyz/assets/images/hacs_logo.png)

_No screenshots; sorry_

## Popup Cards

Use the `custom:popup-card-runner` dashboard card to show reminders or alerts as a popup on your wall-mountedd dashboard.

This system supports two kinds of popups:

### Todo Popup Cards

You can create a todo list entity of tasks to appear as popup cards.

To do this:

1.  Create a todo list entity using any integration
    - Use Local Todo for simplicity, or use Google Tasks so you can add by voice using Google Home devices.
    - Or use your favorite todo platform.
2.  In your wall-mounted dashboard, add the following custom card:

    ```yaml
    type: custom:popup-card-runner
    todo_entity_id: todo.your_tasks
    ```

3.  Optional: To automatically add an emoji for each todo (will be rendered as an icon in the card), add the following automation:

    <details>
        <summary>GenAI Emoji Automation</summary>

        Change `your_tasks` to your todo entities.
        You can change to your favorite LLM.

        ```yaml
        alias: "Popup Cards: Populate todo emojis"
        description: ""
        triggers:
          - trigger: state
            entity_id:
              - todo.aviva_tasks
              - todo.dev_todo_system
          - trigger: time_pattern
            minutes: /30
        conditions: []
        actions:
          - action: todo.get_items
            metadata: {}
            data:
              status: needs_action
            target:
              entity_id:
                - todo.aviva_tasks
                - todo.dev_todo_system
            response_variable: todos
          - repeat:
              sequence:
                - variables:
                    todo_entity_id: "{{ repeat.item }}"
                - repeat:
                    sequence:
                      - variables:
                          details: "{{ repeat.item.description | default('{}') | from_json }}"
                          generated_from: "v1: {{ repeat.item.summary }}"
                      - alias: If we need an emoji
                        if:
                          - condition: template
                            value_template: |-
                              {{ 
                                repeat.item.status == 'needs_action' 
                                and (
                                  'emoji' not in details 
                                  or details.generated_from != generated_from 
                                )
                              }}
                        then:
                          - action: google_generative_ai_conversation.generate_content
                            metadata: {}
                            data:
                              prompt: >-
                                Pick an emoji for the task "{{ repeat.item.summary }}".

                                Your response should consist of one or two emoji
                                characters and no other text
                            response_variable: ai
                          - action: todo.update_item
                            metadata: {}
                            data: |
                              {# 
                                If I pass item: {{ template }} as YAML,
                                the template result gets trimmed, which
                                breaks if there is trailing whitespace.
                              #}
                              {{ {
                                "item": repeat.item.summary,
                                "description": dict(details,  **{ 
                                  'generated_from': generated_from, 
                                  'emoji': ai.text | trim 
                                }) | to_json,
                              } }}
                            target:
                              entity_id: "{{ todo_entity_id }}"
                    for_each: "{{ todos[todo_entity_id]['items'] }}"
              for_each: "{{ todos | list }}"
        ```

        </details>

#### Snoozing

Popup todo cards use the Due field to mean "Snooze until".  If a todo has a due date/time, its popup card will not appear until _after_ that time.  For todo lists that don't support times (eg, Google Tasks), the system can store due times in the description field to allow time-based snoozing anyway.

Each todo card will offer buttons to snooze to any day in the next week.

You can also create an Input Select and/or a Template Sensor named `Snooze Times` with a list of times (eg, `8:00 PM`; must have exactly this format).  Todo popup cards will then offer a `Today at...` menu to snooze to any of those times (that are not in the past).

Use an Input Select to easily adjust the list of times.  Use a template sensor (which must render an array in the `options` attribute) if you want to dynamically compute the set of snooze options in a Jinja template.

### Urgent

You can mark a todo as urgent from the action menu in the popup card (this is stored in the description).  Snoozing a todo to a specific time today also marks as urgent.

Set `show_urgent_todos_only: true` in the card config (or for a specific browser in `browsers:`) to only show popup cards marked urgent.

### Entity Popup Cards

You can create your own popup cards linked to entities, and provide a sensor that specifies which entities to show cards for.

To do this:

1. Create a template sensor (eg, `sensor.popup_cards`) that exposes a JSON array of entity IDs that should appear as popups.
2. Create a hidden dashboard with the URL `popup-cards` (must match exactly) and add a card (I recommend [button_card]) for each of those entities.
3. In your wall-mounted dashboard, add the following custom card:

   ```yaml
   type: custom:popup-card-runner
   card_list_entity_id: sensor.popup_cards
   ```

#### Sample code

<details>
  <summary>Template Sensors</summary>

Here are some sample template sensors to generate the list of active popup cards:

```yaml
template:
  - sensor:
        name: Popup Cards
        icon: "mdi:alert-box-outline"
        state: |
          {%- set ns = namespace(warnings = [
            'cover.garage_door'   if is_state('cover.garage_door', 'open'),
          ]) -%}

          {%- if  is_state('lock.front_door_lock', 'unlocked')
              and (now().hour >= 22 or now().hour < 7) -%}
            {%- set ns.warnings = ns.warnings + ['lock.front_door_lock'] -%}
          {%- endif -%}

          {# Automatically include all vacuums that have problems. #}
          {# Use the camera entity with the map for the card. #}
          {%- set ns.warnings = ns.warnings +
              expand(states.vacuum)
                | selectattr('state', 'in', ['error', 'paused', 'idle'])
                | map(attribute = 'entity_id')
                | map('replace', 'vacuum.', 'camera.')
                | map('regex_replace', '$', '_map')
                | list
           -%}

          {{- ns.warnings | select('defined') | list | to_json -}}
      - name: Reminder Popup Cards
        # Include all input_booleans named `Reminder: ...` that aren't turned on.
        # Write automations to turn off each boolean to set a reminder, and click
        # the popup card to mark it as completed.  You can also combine this with
        # the previous example.
        state: |
          {{
            states.input_boolean
              | selectattr('entity_id', 'contains', '.reminder_')
              | selectattr('state', 'eq', 'on')
              | map(attribute = 'entity_id')
              | list
              | to_json
          }}
      - name: Urgent Popup Cards
        # Use this sensor to display a subset of popup cards on a particular dashboard.
        state: |
          {{
            states('sensor.popup_cards')
              | from_json
              | select('in', label_entities('Urgent Popup Cards'))
              | list
              | to_json
          }}
```

</details>

<details>
  <summary>Cards</summary>
Here are sample cards to include in the Popup Cards dashboard.

```yaml
type: custom:button-card
entity: input_boolean.reminder_took_out_garbage
color: "#388e3c"
color_type: card
name: Take out the garbage!
styles:
  card:
    - height: 300px
    - width: 400px
  icon:
    - color: |
        [[[
          if (entity.state === 'on')
            return 'white';
          else
            return '#6d4c41';
        ]]]
```

```yaml
type: custom:button-card
entity: cover.garage_door
color: var(--state-inactive-color)
color_type: card
name: The garage door is open
styles:
  card:
    - height: 300px
    - width: 400px
  icon:
    - color: "#3949ab"
```

</details>

### Other options

- `reopen_delay_ms`: If the popup is dismissed (by clicking the background), automatically reopen it after waiting this long.
  - If this is omitted or set to `0`, the popup will not reopen until the dashboard is refreshed or a new popup card appears.
- `browser_ids:` A list of [browser_mod] Browser IDs (get these strings from the Browser Mod control panel). If specified, the popup will only appear on these browsers.

  - Use this to make popups only appear on some screens.
  - You can also pass an object to customize behavior for some browsers (eg, only show urgent cards in a front hallway):

    ```yaml
    browser_ids:
        - Kitchen
        - browser_id: Front Hallway
            card_list_entity_id: sensor.urgent_popup_cards
            todo_entity_id: null # Don't show any todos
            # or
            show_urgent_todos_only: true
    ```

[button_card]: https://github.com/custom-cards/button-card
[browser_mod]: https://github.com/thomasloven/hass-browser_mod
