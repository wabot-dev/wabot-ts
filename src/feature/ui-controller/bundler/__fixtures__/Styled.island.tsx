import { island } from '@/ui'
import styles from './styles.module.css'

function Styled() {
  return <div class={styles.box}>styled</div>
}

export default island(Styled)
