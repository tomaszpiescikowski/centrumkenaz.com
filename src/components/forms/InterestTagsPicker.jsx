import EventIcon from '../common/EventIcon'
import { INTEREST_TAGS } from '../../constants/interestTags'

function InterestTagsPicker({ value = [], onChange, t }) {
  const selectedTags = Array.isArray(value) ? value : []

  const toggleTag = (tag) => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag]
    onChange(nextTags)
  }

  return (
    <div className="ui-tag-list">
      {INTEREST_TAGS.map((tag) => {
        const active = selectedTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`ui-tag-chip ${active ? 'ui-tag-chip-active' : 'ui-tag-chip-idle'}`}
          >
            <EventIcon type={tag} size="xs" />
            <span>{t(`eventTypes.${tag}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

export default InterestTagsPicker
